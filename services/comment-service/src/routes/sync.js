const router = require("express").Router();
const axios = require("axios");
const Comment = require("../models/Comment");
const logger = require("../utils/logger");

const POST_SERVICE = process.env.POST_SERVICE_URL || "http://post-service:3002";

router.get("/comment-counts", async (req, res) => {
  try {
    const counts = await Comment.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$postId", count: { $sum: 1 } } },
    ]);

    const results = [];

    for (const { _id: postId, count } of counts) {
      try {
        await axios.patch(
          `${POST_SERVICE}/internal/posts/${postId}/comment-count-set`,
          { count },
          { timeout: 3000 },
        );
        results.push({ postId, count, status: "ok" });
        logger.info(`Synced comment count for post ${postId}: ${count}`);
      } catch (err) {
        results.push({ postId, count, status: "failed", error: err.message });
        logger.warn(`Failed to sync post ${postId}:`, err.message);
      }
    }

    res.json({
      message: `Synced ${results.filter((r) => r.status === "ok").length}/${results.length} posts`,
      results,
    });
  } catch (err) {
    logger.error("Sync error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
