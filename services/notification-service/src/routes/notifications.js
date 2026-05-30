const router = require("express").Router();

const {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  getUnreadCount,
} = require("../controllers/notificationController");

// list + stats
router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);

// bulk actions
router.patch("/read-all", markAllRead);

// single item actions
router.patch("/:id/read", markRead);
router.delete("/:id", deleteNotification);

module.exports = router;
