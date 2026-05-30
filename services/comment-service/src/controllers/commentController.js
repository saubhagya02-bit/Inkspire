const axios = require("axios");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const Comment = require("../models/Comment");
const logger = require("../utils/logger");
const { getRedis } = require("../utils/redis");
const { publishEvent } = require("../utils/rabbitmq");

const { window } = new JSDOM("");
const DOMPurify = createDOMPurify(window);

const CACHE_TTL = 60;
const MAX_REPLIES_PREVIEW = 5;
const POST_SERVICE_URL =
  process.env.POST_SERVICE_URL || "http://post-service:3002";

const updatePostCommentCount = async (postId, delta) => {
  try {
    await axios.patch(
      `${POST_SERVICE}/internal/posts/${postId}/comment-count`,
      { delta },
      { timeout: 3000 },
    );
  } catch (err) {
    logger.warn(
      `Failed to update comment_count for post ${postId}:`,
      err.message,
    );
  }
};

// Cache invalidation
const invalidatePostCommentCache = async (postId) => {
  try {
    const redis = getRedis();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        `comments:${postId}:*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length) await redis.del(keys);
    } while (cursor !== "0");
  } catch (err) {
    logger.warn("Comment cache invalidation failed:", err.message);
  }
};

// CREATE COMMENT
const createComment = async (req, res) => {
  const authorId = req.headers["x-user-id"];
  const authorUsername =
    req.headers["x-user-username"] ||
    req.headers["x-user-email"]?.split("@")[0] ||
    "user";
  const { postId } = req.params;
  const { content, parentId } = req.body;

  try {
    let depth = 0;
    if (parentId) {
      const parent = await Comment.findById(parentId);
      if (!parent)
        return res.status(404).json({ error: "Parent comment not found" });
      if (parent.depth >= 2)
        return res.status(400).json({ error: "Maximum nesting depth reached" });
      depth = parent.depth + 1;
      await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } });
    }

    const contentHtml = DOMPurify.sanitize(content.replace(/\n/g, "<br>"));

    const comment = await Comment.create({
      postId,
      authorId,
      authorUsername,
      content,
      contentHtml,
      parentId: parentId || null,
      depth,
    });

    await updatePostCommentCount(postId, 1);

    await invalidatePostCommentCache(postId);

    await publishEvent("comment.created", {
      commentId: comment._id.toString(),
      postId,
      authorId,
      authorUsername,
      content,
      postOwnerId: req.headers["x-post-owner-id"] || null,
    });

    res.status(201).json(comment);
  } catch (err) {
    logger.error("Create comment error:", err);
    res.status(500).json({ error: "Failed to create comment" });
  }
};

// GET COMMENTS
const getComments = async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 20, sort = "createdAt" } = req.query;
  const redis = getRedis();
  const cacheKey = `comments:${postId}:${page}:${limit}:${sort}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const sortObj =
      sort === "top" ? { "reactionCounts.like": -1 } : { [sort]: -1 };

    const [comments, total] = await Promise.all([
      Comment.find({ postId, parentId: null, isApproved: true })
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Comment.countDocuments({ postId, parentId: null, isApproved: true }),
    ]);

    const commentIds = comments.map((c) => c._id);

    const replies = await Comment.aggregate([
      { $match: { parentId: { $in: commentIds }, isApproved: true } },
      { $sort: { createdAt: 1 } },
      { $group: { _id: "$parentId", replies: { $push: "$$ROOT" } } },
      { $project: { replies: { $slice: ["$replies", MAX_REPLIES_PREVIEW] } } },
    ]);

    const replyMap = replies.reduce((acc, r) => {
      acc[r._id.toString()] = r.replies;
      return acc;
    }, {});

    const threaded = comments.map((c) => ({
      ...c,
      replies: replyMap[c._id.toString()] || [],
    }));

    const result = {
      comments: threaded,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    logger.error("Get comments error:", err);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
};

// UPDATE COMMENT
const updateComment = async (req, res) => {
  const authorId = req.headers["x-user-id"];
  const { id } = req.params;
  const { content } = req.body;

  try {
    const comment = await Comment.findById(id);
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    if (comment.authorId !== authorId)
      return res.status(403).json({ error: "Not authorized" });

    comment.content = content;
    comment.contentHtml = DOMPurify.sanitize(content.replace(/\n/g, "<br>"));
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    await invalidatePostCommentCache(comment.postId);
    res.json(comment);
  } catch (err) {
    logger.error("Update comment error:", err);
    res.status(500).json({ error: "Failed to update comment" });
  }
};

// DELETE COMMENT
const deleteComment = async (req, res) => {
  const authorId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];
  const { id } = req.params;

  try {
    const comment = await Comment.findById(id);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    if (
      comment.authorId !== authorId &&
      !["admin", "editor"].includes(userRole)
    )
      return res.status(403).json({ error: "Not authorized" });

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    comment.content = "[deleted]";
    comment.contentHtml = "<em>[deleted]</em>";
    await comment.save();

    if (comment.parentId) {
      await Comment.findByIdAndUpdate(comment.parentId, {
        $inc: { replyCount: -1 },
      });
    }

    await decrementCommentCount(comment.postId);

    await invalidatePostCommentCache(comment.postId);
    res.json({ message: "Comment deleted" });
  } catch (err) {
    logger.error("Delete comment error:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
};

// REACT TO COMMENT
const reactToComment = async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { id } = req.params;
  const { type } = req.body;

  const allowed = ["like", "love", "laugh", "sad", "angry"];
  if (!type || !allowed.includes(type))
    return res.status(400).json({ error: "Invalid reaction type" });

  try {
    const comment = await Comment.findById(id);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const existing = comment.reactions.find((r) => r.userId === userId);
    if (existing) {
      if (existing.type === type) {
        comment.reactions = comment.reactions.filter(
          (r) => r.userId !== userId,
        );
        comment.reactionCounts[type] = Math.max(
          0,
          (comment.reactionCounts[type] || 0) - 1,
        );
      } else {
        comment.reactionCounts[existing.type] = Math.max(
          0,
          (comment.reactionCounts[existing.type] || 0) - 1,
        );
        existing.type = type;
        comment.reactionCounts[type] = (comment.reactionCounts[type] || 0) + 1;
      }
    } else {
      comment.reactions.push({ userId, type });
      comment.reactionCounts[type] = (comment.reactionCounts[type] || 0) + 1;
    }

    comment.markModified("reactionCounts");
    await comment.save();
    await invalidatePostCommentCache(comment.postId);

    res.json({ reactionCounts: comment.reactionCounts });
  } catch (err) {
    logger.error("React to comment error:", err);
    res.status(500).json({ error: "Failed to react to comment" });
  }
};

module.exports = {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  reactToComment,
};
