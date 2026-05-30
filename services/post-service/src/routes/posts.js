const router = require("express").Router();
const { body } = require("express-validator");
const { pool } = require("../utils/database");
const logger = require("../utils/logger");

const {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  likePost,
} = require("../controllers/postController");

const { validate } = require("../middleware/validate");
const { authenticateToken } = require("../middleware/auth");

// Validation rule sets
const createRules = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 500 })
    .withMessage("Title too long"),
  body("content").notEmpty().withMessage("Content is required"),
  body("status")
    .optional()
    .isIn(["draft", "published", "archived", "scheduled"]),
  body("visibility").optional().isIn(["public", "private", "members"]),
];

const updateRules = [
  body("title").optional().isLength({ max: 500 }).withMessage("Title too long"),
  body("content").optional(),
  body("status")
    .optional()
    .isIn(["draft", "published", "archived", "scheduled"]),
  body("visibility").optional().isIn(["public", "private", "members"]),
  body("coverImageUrl")
    .optional()
    .isURL({ require_tld: false })
    .withMessage("Cover image must be a valid URL"),
];

// Public routes
router.get("/", getPosts);
router.get("/:slugOrId", getPost);

// Protected routes
router.post("/", authenticateToken, createRules, validate, createPost);
router.patch("/:id", authenticateToken, updateRules, validate, updatePost);
router.delete("/:id", authenticateToken, deletePost);
router.post("/:id/like", authenticateToken, likePost);

// comment count sync from notification worker
router.patch("/:id/comment-count", async (req, res) => {
  const { id } = req.params;
  const { delta } = req.body;

  if (delta !== 1 && delta !== -1)
    return res.status(400).json({ error: "delta must be 1 or -1" });

  try {
    await pool.query(
      "UPDATE posts SET comment_count = GREATEST(0, comment_count + $1) WHERE id = $2",
      [delta, id],
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error("Comment count update error:", err);
    res.status(500).json({ error: "Failed to update comment count" });
  }
});

module.exports = router;
