const router = require("express").Router();
const { pool } = require("../utils/database");
const logger = require("../utils/logger");

const { authenticateToken } = require("../middleware/auth");
router.use(authenticateToken);

// GET /api/auth/users/me
router.get("/me", async (req, res) => {
  const userId = req.headers["x-user-id"];
  try {
    const { rows } = await pool.query(
      `SELECT id, email, username, full_name, avatar_url, role, is_verified, 
              two_factor_enabled, last_login_at, created_at 
       FROM users WHERE id = $1`,
      [userId],
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    logger.error("Get me error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PATCH /api/auth/users/me
router.patch("/me", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { fullName, avatarUrl, username } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE users SET 
         full_name = COALESCE($1, full_name),
         avatar_url = COALESCE($2, avatar_url),
         username = COALESCE($3, username),
         updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, username, full_name, avatar_url, role`,
      [fullName, avatarUrl, username, userId],
    );
    res.json(rows[0]);
  } catch (err) {
    logger.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /api/auth/users/:id (public profile)
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, full_name, avatar_url, created_at FROM users WHERE id = $1",
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

module.exports = router;
