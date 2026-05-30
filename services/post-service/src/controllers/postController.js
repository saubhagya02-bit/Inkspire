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

// Helpers
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
  throw new Error("Could not generate unique slug");
};

const calculateReadingTime = (content) =>
  Math.ceil(content.trim().split(/\s+/).length / 200) || 1;

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

    const authorUsername =
      req.headers["x-user-username"] ||
      req.headers["x-user-email"]?.split("@")[0] ||
      "Anonymous";

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

    if (!title?.trim())
      return res.status(400).json({ error: "title is required" });
    if (!content?.trim())
      return res.status(400).json({ error: "content is required" });

    const slug = await generateSlug(title);
    const contentHtml = DOMPurify.sanitize(marked.parse(content));
    const readingTime = calculateReadingTime(content);
    const publishedAt = status === "published" ? new Date() : null;

    const { rows } = await pool.query(
      `INSERT INTO posts (
         title, slug, excerpt, content, content_html,
         cover_image_url, author_id, author_username, category_id,
         status, visibility, scheduled_at, published_at,
         reading_time, seo_title, seo_description
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        title,
        slug,
        excerpt || null,
        content,
        contentHtml,
        coverImageUrl || null,
        authorId,
        authorUsername,
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
        excerpt: post.excerpt || "",
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
    const safeParams = {};
    const CACHE_KEY_PARAMS = [
      "page",
      "limit",
      "status",
      "category",
      "tag",
      "sort",
    ];
    for (const key of CACHE_KEY_PARAMS) {
      if (req.query[key] !== undefined) safeParams[key] = req.query[key];
    }

    const userId = req.headers["x-user-id"];

    const cacheKey = `posts:list:${userId || "anon"}:${JSON.stringify(safeParams)}`;

    const { getRedis } = require("../utils/redis");
    const cacheGet = async (key) => {
      try {
        const v = await getRedis().get(key);
        return v ? JSON.parse(v) : null;
      } catch {
        return null;
      }
    };
    const cacheSet = async (key, value, ttl = 300) => {
      try {
        await getRedis().setex(key, ttl, JSON.stringify(value));
      } catch {}
    };

    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const { pool } = require("../utils/database");
    const {
      page = 1,
      limit = 20,
      sort = "published_at",
      category,
      tag,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const params = [];
    const joins = [];
    const filters = ["(p.status = 'published' AND p.visibility = 'public')"];

    if (userId) {
      params.push(userId);
      filters.push(`p.author_id = $${params.length}`);
    }

    if (category) {
      params.push(category);
      joins.push(
        `JOIN categories c ON c.id = p.category_id AND c.slug = $${params.length}`,
      );
    }

    if (tag) {
      params.push(tag);
      joins.push(
        `JOIN post_tags pt ON pt.post_id = p.id JOIN tags t ON t.id = pt.tag_id AND t.slug = $${params.length}`,
      );
    }

    const allowedSorts = {
      published_at: "p.published_at",
      created_at: "p.created_at",
      view_count: "p.view_count",
    };
    const orderBy = allowedSorts[sort] || "p.published_at";

    params.push(limitNum, offset);
    const limitParam = `$${params.length - 1}`;
    const offsetParam = `$${params.length}`;

    const whereClause = `WHERE ${filters.join(" OR ")}`;
    const joinClause = joins.join(" ");

    const isLikedSelect = userId
      ? `EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = '${userId}') AS is_liked`
      : `FALSE AS is_liked`;

    const sql = `
      SELECT p.*, COUNT(*) OVER() AS total_count, ${isLikedSelect}
      FROM posts p
      ${joinClause}
      ${whereClause}
      ORDER BY ${orderBy} DESC NULLS LAST
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const result = await pool.query(sql, params);

    const total = result.rows[0] ? parseInt(result.rows[0].total_count) : 0;

    const response = {
      posts: result.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    await cacheSet(cacheKey, response);
    res.json(response);
  } catch (err) {
    const logger = require("../utils/logger");
    logger.error("Get posts error:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};

module.exports = getPosts;

// GET SINGLE POST
const getPost = async (req, res) => {
  try {
    const { slugOrId } = req.params;
    const userId = req.headers["x-user-id"];

    let likedSelect = "false AS is_liked";
    const queryParams = [slugOrId];
    if (userId) {
      queryParams.push(userId); // $2
      likedSelect = `EXISTS(
        SELECT 1 FROM post_likes pl
        WHERE pl.post_id = p.id AND pl.user_id = $2
      ) AS is_liked`;
    }

    let result = await pool.query(
      `SELECT p.*, ${likedSelect} FROM posts p WHERE p.slug = $1 LIMIT 1`,
      queryParams,
    );

    if (result.rows.length === 0 && /^[0-9a-f-]{36}$/i.test(slugOrId)) {
      result = await pool.query(
        `SELECT p.*, ${likedSelect} FROM posts p WHERE p.id = $1 LIMIT 1`,
        queryParams,
      );
    }

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Post not found" });

    const post = result.rows[0];

    // Deduplicated view count via Redis
    if (userId) {
      const redis = getRedis();
      const viewKey = `viewed:${post.id}:${userId}`;
      const already = await redis.get(viewKey).catch(() => null);
      if (!already) {
        pool
          .query("UPDATE posts SET view_count = view_count + 1 WHERE id = $1", [
            post.id,
          ])
          .catch(() => {});
        redis.setex(viewKey, 3600, "1").catch(() => {});
      }
    }

    res.json(post);
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
      coverImageUrl,
      seoTitle,
      seoDescription,
    } = req.body;

    const existing = await pool.query("SELECT * FROM posts WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0)
      return res.status(404).json({ error: "Post not found" });

    const post = existing.rows[0];

    if (post.author_id !== authorId && !["admin", "editor"].includes(userRole))
      return res.status(403).json({ error: "Not authorized" });

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
         title           = COALESCE($1,  title),
         slug            = $2,
         content         = COALESCE($3,  content),
         content_html    = $4,
         excerpt         = COALESCE($5,  excerpt),
         status          = COALESCE($6,  status),
         visibility      = COALESCE($7,  visibility),
         cover_image_url = COALESCE($8,  cover_image_url),
         reading_time    = $9,
         seo_title       = COALESCE($10, seo_title),
         seo_description = COALESCE($11, seo_description),
         published_at    = $12,
         updated_at      = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        title || null,
        slug,
        content || null,
        contentHtml,
        excerpt || null,
        status || null,
        visibility || null,
        coverImageUrl || null,
        readingTime,
        seoTitle || null,
        seoDescription || null,
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
        excerpt: result.rows[0].excerpt || "",
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

    const insertResult = await pool.query(
      `INSERT INTO post_likes (user_id, post_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, post_id) DO NOTHING`,
      [userId, id],
    );

    let liked;
    if (insertResult.rowCount > 0) {
      await pool.query(
        "UPDATE posts SET like_count = like_count + 1 WHERE id = $1",
        [id],
      );
      liked = true;
    } else {
      await pool.query(
        "DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2",
        [userId, id],
      );
      await pool.query(
        "UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = $1",
        [id],
      );
      liked = false;
    }

    const { rows } = await pool.query(
      "SELECT like_count FROM posts WHERE id = $1",
      [id],
    );

    await invalidatePostsCache();

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
