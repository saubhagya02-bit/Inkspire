const router = require("express").Router();

const {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  getUnreadCount,
} = require("../controllers/notificationController");

// Literal routes FIRST
router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllRead);

// Parameterised routes AFTER
router.patch("/:id/read", markRead);
router.delete("/:id", deleteNotification);

module.exports = router;
