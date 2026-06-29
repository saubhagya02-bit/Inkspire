const router = require("express").Router();
const { pool } = require("../utils/database");
const logger = require("../utils/logger");
const { publishEvent } = require("../utils/rabbitmq");
const { authenticateToken } = require("../middleware/auth");

// POST /api/auth/users/:id/follow
router.post("/:id/follow", authenticateToken, async (req, res) => {
  const followerId = req.user.id;
  const followingId = req.params.id;

  if (followerId === followingId) {
    return res.status(400).json({ error: "You cannot follow yourself" });
  }

  try {
    // Check target user exists
    const { rows: target } = await pool.query(
      "SELECT id, username FROM users WHERE id = $1",
      [followingId],
    );
    if (!target.length)
      return res.status(404).json({ error: "User not found" });

    // Insert follow (ignore if already following)
    const { rowCount } = await pool.query(
      `INSERT INTO follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [followerId, followingId],
    );

    if (rowCount > 0) {
      // Update counters
      await pool.query(
        "UPDATE users SET following_count = following_count + 1 WHERE id = $1",
        [followerId],
      );
      await pool.query(
        "UPDATE users SET follower_count = follower_count + 1 WHERE id = $1",
        [followingId],
      );

      await publishEvent("user.followed", {
        followerId,
        followerUsername: req.user.username || req.user.email?.split("@")[0],
        followingId,
        followingUsername: target[0].username,
      });
    }

    const { rows } = await pool.query(
      "SELECT follower_count, following_count FROM users WHERE id = $1",
      [followingId],
    );

    res.json({ following: true, followerCount: rows[0].follower_count });
  } catch (err) {
    logger.error("Follow error:", err);
    res.status(500).json({ error: "Failed to follow user" });
  }
});

// DELETE /api/auth/users/:id/follow
router.delete("/:id/follow", authenticateToken, async (req, res) => {
  const followerId = req.user.id;
  const followingId = req.params.id;

  try {
    const { rowCount } = await pool.query(
      "DELETE FROM follows WHERE follower_id = $1 AND following_id = $2",
      [followerId, followingId],
    );

    if (rowCount > 0) {
      await pool.query(
        "UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = $1",
        [followerId],
      );
      await pool.query(
        "UPDATE users SET follower_count = GREATEST(0, follower_count - 1) WHERE id = $1",
        [followingId],
      );
    }

    const { rows } = await pool.query(
      "SELECT follower_count FROM users WHERE id = $1",
      [followingId],
    );

    res.json({ following: false, followerCount: rows[0].follower_count });
  } catch (err) {
    logger.error("Unfollow error:", err);
    res.status(500).json({ error: "Failed to unfollow user" });
  }
});

// GET /api/auth/users/:id/follow-status
router.get("/:id/follow-status", authenticateToken, async (req, res) => {
  const followerId = req.user.id;
  const followingId = req.params.id;

  try {
    const { rows } = await pool.query(
      "SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2",
      [followerId, followingId],
    );
    const { rows: counts } = await pool.query(
      "SELECT follower_count, following_count FROM users WHERE id = $1",
      [followingId],
    );
    res.json({
      following: rows.length > 0,
      followerCount: counts[0]?.follower_count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to check follow status" });
  }
});

// GET /api/auth/users/:id/followers
router.get("/:id/followers", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.follower_count
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT 50`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch followers" });
  }
});

// GET /api/auth/users/:id/following
router.get("/:id/following", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.follower_count
       FROM follows f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT 50`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch following" });
  }
});

module.exports = router;
