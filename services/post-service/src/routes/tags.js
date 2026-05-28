const router = require("express").Router();
const { pool } = require("../utils/database");
const { authenticateToken } = require("../middleware/auth");

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, COUNT(pt.post_id) as post_count
       FROM tags t
       LEFT JOIN post_tags pt ON pt.tag_id = t.id
       GROUP BY t.id
       ORDER BY post_count DESC`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  const { name } = req.body;
  const slug = name.toLowerCase().trim().replace(/\s+/g, "-");
  try {
    const { rows } = await pool.query(
      "INSERT INTO tags (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING RETURNING *",
      [name, slug],
    );
    res.status(201).json(rows[0] || { error: "Tag exists" });
  } catch (err) {
    res.status(400).json({ error: "Failed to create tag" });
  }
});

module.exports = router;
