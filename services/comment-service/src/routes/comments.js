const router = require("express").Router();
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  reactToComment,
} = require("../controllers/commentController");
const { authenticateToken } = require("../middleware/auth");

// Public
router.get("/posts/:postId", getComments);

// Protected
router.post(
  "/posts/:postId",
  body("content")
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ max: 5000 }),
  validate,
  createComment,
);

router.patch(
  "/:id",
  body("content").notEmpty().isLength({ max: 5000 }),
  validate,
  updateComment,
);

router.delete("/:id", deleteComment);

router.post(
  "/:id/react",
  body("type")
    .notEmpty()
    .isIn(["like", "love", "laugh", "sad", "angry"])
    .withMessage("type must be one of: like, love, laugh, sad, angry"),
  validate,
  reactToComment,
);

module.exports = router;
