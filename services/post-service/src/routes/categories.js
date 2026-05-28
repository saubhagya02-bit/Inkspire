const router = require("express").Router();
const { pool } = require("../utils/database");
const { authenticateToken } = require("../middleware/auth");

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM categories ORDER BY name");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const slug = name.toLowerCase().trim().replace(/\s+/g, "-");

  try {
    const { rows } = await pool.query(
      "INSERT INTO categories (name, slug, description) VALUES ($1, $2, $3) RETURNING *",
      [name, slug, description],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: "Category already exists" });
  }
});

module.exports = router;
