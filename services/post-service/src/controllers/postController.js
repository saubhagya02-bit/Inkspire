const slugify = require("slugify");
const { marked } = require("marked");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");

const { pool } = require("../utils/database");
const { getRedis } = require("../utils/redis");
const { publishEvent } = require("../utils/rabbitmq");
const logger = require("../utils/logger");

const { window } = new JSDOM("");
const DOMPurify = createDOMPurify(window);

const CACHE_TTL = 300;

const CACHE_KEY_PARAMS = ["page", "limit", "status", "category", "tag", "sort"];

// Slug helper

const generateSlug = async (title, excludeId = null) => {
  const base = slugify(title, { lower: true, strict: true });
  let slug = base;
  let counter = 1;

  while (counter <= 100) {
    const query = excludeId
      ? "SELECT id FROM posts WHERE slug = $1 AND id != $2"
      : "SELECT id FROM posts WHERE slug = $1";
    const params = excludeId ? [slug, excludeId] : [slug];
    const { rows } = await pool.query(query, params);
    if (rows.length === 0) return slug;
    slug = `${base}-${counter++}`;
  }
  throw new Error("Could not generate unique slug after 100 attempts");
};

const calculateReadingTime = (content) =>
  Math.ceil(content.trim().split(/\s+/).length / 200);

// Invalidate posts cache
const invalidatePostsCache = async () => {
  try {
    const redis = getRedis();

    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        "posts:list:*",
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length) await redis.del(keys);
    } while (cursor !== "0");
  } catch (err) {
    logger.warn("Cache invalidation failed:", err.message);
  }
};

// CREATE POST
const createPost = async (req, res) => {
  try {
    const authorId = String(req.headers["x-user-id"]);

    const {
      title,
      content,
      excerpt,
      status = "draft",
      visibility = "public",
      categoryId,
      coverImageUrl,
      scheduledAt,
      seoTitle,
      seoDescription,
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "title and content are required" });
    }

    const slug = await generateSlug(title);

    const contentHtml = DOMPurify.sanitize(marked.parse(content));
    const readingTime = calculateReadingTime(content);
    const publishedAt = status === "published" ? new Date() : null;

    const { rows } = await pool.query(
      `INSERT INTO posts (
         title, slug, excerpt, content, content_html,
         cover_image_url, author_id, category_id,
         status, visibility, scheduled_at, published_at,
         reading_time, seo_title, seo_description
       ) VALUES (
         $1,$2,$3,$4,$5,
         $6,$7,$8,
         $9,$10,$11,$12,
         $13,$14,$15
       ) RETURNING *`,
      [
        title,
        slug,
        excerpt || null,
        content,
        contentHtml,
        coverImageUrl || null,
        authorId,
        categoryId ? Number(categoryId) : null,
        status,
        visibility,
        scheduledAt || null,
        publishedAt,
        readingTime,
        seoTitle || null,
        seoDescription || null,
      ],
    );

    const post = rows[0];

    await invalidatePostsCache();

    if (status === "published") {
      await publishEvent("post.published", {
        postId: post.id,
        title: post.title,
        authorId,
        slug: post.slug,
      });
    }

    res.status(201).json(post);
  } catch (err) {
    logger.error("Create post error:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
};

// GET POSTS
const getPosts = async (req, res) => {
  try {
    const redis = getRedis();

    const safeParams = {};
    for (const key of CACHE_KEY_PARAMS) {
      if (req.query[key] !== undefined) safeParams[key] = req.query[key];
    }
    const cacheKey = `posts:list:${JSON.stringify(safeParams)}`;

    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const {
      page = 1,
      limit = 20,
      category,
      tag,
      sort = "published_at",
    } = req.query;
    const userRole = req.headers["x-user-role"];
    const userId = req.headers["x-user-id"];

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = `WHERE (p.status = 'published' AND p.visibility = 'public')`;
    const params = [];

    if (userId) {
      whereClause += ` OR p.author_id = $${params.length + 1}`;
      params.push(userId);
    }

    let categoryJoin = "";
    if (category) {
      params.push(category);
      categoryJoin = `JOIN categories c ON c.id = p.category_id AND c.slug = $${params.length}`;
    }

    let tagJoin = "";
    if (tag) {
      params.push(tag);
      tagJoin = `JOIN post_tags pt ON pt.post_id = p.id JOIN tags t ON t.id = pt.tag_id AND t.slug = $${params.length}`;
    }

    const allowedSorts = {
      published_at: "p.published_at",
      created_at: "p.created_at",
      view_count: "p.view_count",
    };
    const orderBy = allowedSorts[sort] || "p.published_at";

    params.push(limitNum, offset);
    const result = await pool.query(
      `SELECT p.*, COUNT(*) OVER() as total_count
       FROM posts p ${categoryJoin} ${tagJoin}
       ${whereClause}
       ORDER BY ${orderBy} DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const total = result.rows[0]?.total_count
      ? parseInt(result.rows[0].total_count)
      : 0;
    const response = {
      posts: result.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
    res.json(response);
  } catch (err) {
    logger.error("Get posts error:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};

// ── GET SINGLE POST ───────────────────────────────────────────────────────────
const getPost = async (req, res) => {
  try {
    const { slugOrId } = req.params;

    let result = await pool.query(
      "SELECT * FROM posts WHERE slug = $1 LIMIT 1",
      [slugOrId],
    );

    if (result.rows.length === 0 && /^[0-9a-f-]{36}$/i.test(slugOrId)) {
      result = await pool.query("SELECT * FROM posts WHERE id = $1 LIMIT 1", [
        slugOrId,
      ]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    pool
      .query("UPDATE posts SET view_count = view_count + 1 WHERE id = $1", [
        result.rows[0].id,
      ])
      .catch((err) => logger.warn("View count update failed:", err.message));

    res.json(result.rows[0]);
  } catch (err) {
    logger.error("Get post error:", err);
    res.status(500).json({ error: "Failed to fetch post" });
  }
};

// UPDATE POST
const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const authorId = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];
    const {
      title,
      content,
      status,
      excerpt,
      visibility,
      seoTitle,
      seoDescription,
    } = req.body;

    const existing = await pool.query("SELECT * FROM posts WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0)
      return res.status(404).json({ error: "Post not found" });

    const post = existing.rows[0];

    if (
      post.author_id !== authorId &&
      !["admin", "editor"].includes(userRole)
    ) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const slug = title ? await generateSlug(title, id) : post.slug;
    const contentHtml = content
      ? DOMPurify.sanitize(marked.parse(content))
      : post.content_html;
    const readingTime = content
      ? calculateReadingTime(content)
      : post.reading_time;
    const wasPublished = post.status !== "published" && status === "published";
    const publishedAt = wasPublished ? new Date() : post.published_at;

    const result = await pool.query(
      `UPDATE posts SET
         title       = COALESCE($1, title),
         slug        = $2,
         content     = COALESCE($3, content),
         content_html = $4,
         excerpt     = COALESCE($5, excerpt),
         status      = COALESCE($6, status),
         visibility  = COALESCE($7, visibility),
         reading_time = $8,
         seo_title   = COALESCE($9, seo_title),
         seo_description = COALESCE($10, seo_description),
         published_at = $11,
         updated_at  = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        title,
        slug,
        content,
        contentHtml,
        excerpt,
        status,
        visibility,
        readingTime,
        seoTitle,
        seoDescription,
        publishedAt,
        id,
      ],
    );

    await invalidatePostsCache();

    if (wasPublished) {
      await publishEvent("post.published", {
        postId: result.rows[0].id,
        title: result.rows[0].title,
        authorId,
        slug: result.rows[0].slug,
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error("Update post error:", err);
    res.status(500).json({ error: "Failed to update post" });
  }
};

// DELETE POST
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const authorId = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];

    const existing = await pool.query(
      "SELECT author_id FROM posts WHERE id = $1",
      [id],
    );
    if (existing.rows.length === 0)
      return res.status(404).json({ error: "Post not found" });
    if (
      existing.rows[0].author_id !== authorId &&
      !["admin", "editor"].includes(userRole)
    ) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await pool.query("DELETE FROM posts WHERE id = $1", [id]);
    await invalidatePostsCache();
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    logger.error("Delete post error:", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
};

// LIKE POST
const likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["x-user-id"];
    if (!userId)
      return res.status(401).json({ error: "Authentication required" });

    // Toggle: insert or delete
    const existing = await pool.query(
      "SELECT 1 FROM post_likes WHERE user_id = $1 AND post_id = $2",
      [userId, id],
    );

    let liked;
    if (existing.rows.length > 0) {
      await pool.query(
        "DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2",
        [userId, id],
      );
      await pool.query(
        "UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = $1",
        [id],
      );
      liked = false;
    } else {
      await pool.query(
        "INSERT INTO post_likes (user_id, post_id) VALUES ($1, $2)",
        [userId, id],
      );
      await pool.query(
        "UPDATE posts SET like_count = like_count + 1 WHERE id = $1",
        [id],
      );
      liked = true;
    }

    const { rows } = await pool.query(
      "SELECT like_count FROM posts WHERE id = $1",
      [id],
    );
    res.json({ liked, likeCount: rows[0]?.like_count ?? 0 });
  } catch (err) {
    logger.error("Like post error:", err);
    res.status(500).json({ error: "Failed to like post" });
  }
};

module.exports = {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  likePost,
};
