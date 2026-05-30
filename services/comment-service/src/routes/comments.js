const router = require("express").Router();
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticateToken } = require("../middleware/auth");
const {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  reactToComment,
} = require("../controllers/commentController");

// Public — anyone can read comments
router.get("/posts/:postId", getComments);

// Protected
router.post(
  "/posts/:postId",
  authenticateToken,
  body("content")
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ max: 5000 }),
  validate,
  createComment,
);

router.patch(
  "/:id",
  authenticateToken,
  body("content").notEmpty().isLength({ max: 5000 }),
  validate,
  updateComment,
);

router.delete("/:id", authenticateToken, deleteComment);

router.post(
  "/:id/react",
  authenticateToken,
  body("type")
    .notEmpty()
    .isIn(["like", "love", "laugh", "sad", "angry"])
    .withMessage("type must be one of: like, love, laugh, sad, angry"),
  validate,
  reactToComment,
);

module.exports = router;
