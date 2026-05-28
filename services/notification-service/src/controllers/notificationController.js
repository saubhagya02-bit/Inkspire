const Notification = require("../models/Notification");
const logger = require("../utils/logger");

// GET /api/notifications

const getNotifications = async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { page = 1, limit = 20, unreadOnly } = req.query;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

  try {
    const filter = { userId };
    if (unreadOnly === "true") filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    res.json({
      notifications,
      unreadCount,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    logger.error("Get notifications error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { id } = req.params;

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true, readAt: new Date() },
      { new: true },
    );
    if (!notification)
      return res.status(404).json({ error: "Notification not found" });
    res.json(notification);
  } catch (err) {
    logger.error("Mark read error:", err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
  const userId = req.headers["x-user-id"];
  try {
    await Notification.markAllRead(userId);
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    logger.error("Mark all read error:", err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  const userId = req.headers["x-user-id"];
  try {
    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId,
    });
    if (!deleted)
      return res.status(404).json({ error: "Notification not found" });
    res.json({ message: "Notification deleted" });
  } catch (err) {
    logger.error("Delete notification error:", err);
    res.status(500).json({ error: "Failed to delete notification" });
  }
};

// GET /api/notifications/unread-count
const getUnreadCount = async (req, res) => {
  const userId = req.headers["x-user-id"];
  try {
    const count = await Notification.countDocuments({ userId, isRead: false });
    res.json({ count });
  } catch (err) {
    logger.error("Unread count error:", err);
    res.status(500).json({ error: "Failed to fetch count" });
  }
};

module.exports = {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  getUnreadCount,
};
