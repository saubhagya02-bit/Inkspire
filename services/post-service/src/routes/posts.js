const router = require("express").Router();
const { body } = require("express-validator");

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

// Validation rules
const postRules = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 500 })
    .withMessage("Title too long"),

  body("content")
    .notEmpty()
    .withMessage("Content is required"),

  body("status")
    .optional()
    .isIn(["draft", "published", "archived", "scheduled"]),

  body("visibility")
    .optional()
    .isIn(["public", "private", "members"]),
];

// Public routes
router.get("/", getPosts);
router.get("/:slugOrId", getPost);

// Protected routes
router.post(
  "/",
  authenticateToken,
  postRules,
  validate,
  createPost
);

router.patch(
  "/:id",
  authenticateToken,
  postRules,
  validate,
  updatePost
);

router.delete(
  "/:id",
  authenticateToken,
  deletePost
);

router.post(
  "/:id/like",
  authenticateToken,
  likePost
);

module.exports = router;