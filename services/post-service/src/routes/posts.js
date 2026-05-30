const router = require("express").Router();
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticateToken } = require("../middleware/auth");
const {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  likePost,
} = require("../controllers/postController");

// Public
router.get("/", getPosts);
router.get("/:slugOrId", getPost);

// Protected
router.post(
  "/",
  authenticateToken,
  body("title").notEmpty().withMessage("Title is required"),
  body("content").notEmpty().withMessage("Content is required"),
  validate,
  createPost,
);

router.patch("/:id", authenticateToken, updatePost);
router.delete("/:id", authenticateToken, deletePost);
router.post("/:id/like", authenticateToken, likePost);

module.exports = router;
