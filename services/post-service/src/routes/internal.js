const router = require("express").Router();
const { pool } = require("../utils/database");
const logger = require("../utils/logger");

router.patch("/posts/:postId/comment-count", async (req, res) => {
  const { postId } = req.params;
  const { delta } = req.body;

  if (delta !== 1 && delta !== -1) {
    return res.status(400).json({ error: "delta must be 1 or -1" });
  }

  try {
    await pool.query(
      `UPDATE posts
       SET comment_count = GREATEST(0, comment_count + $1)
       WHERE id = $2`,
      [delta, postId],
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error("Update comment_count error:", err);
    res.status(500).json({ error: "Failed to update comment count" });
  }
});

router.patch("/posts/:postId/comment-count-set", async (req, res) => {
  const { postId } = req.params;
  const { count } = req.body;

  if (typeof count !== "number" || count < 0) {
    return res
      .status(400)
      .json({ error: "count must be a non-negative number" });
  }

  try {
    await pool.query("UPDATE posts SET comment_count = $1 WHERE id = $2", [
      count,
      postId,
    ]);
    res.json({ ok: true, postId, count });
  } catch (err) {
    logger.error("Set comment_count error:", err);
    res.status(500).json({ error: "Failed to set comment count" });
  }
});

module.exports = router;
