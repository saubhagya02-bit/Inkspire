const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },

    type: {
      type: String,
      required: true,
      enum: [
        "comment_on_post",
        "reply_to_comment",
        "post_published",
        "post_liked",
        "new_follower",
        "welcome",
        "password_reset",
        "email_verify",
        "system",
      ],
    },

    title: { type: String, required: true },

    body: { type: String, required: true },

    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Optional: the user who triggered this notification (commenter, follower, etc.)
    actorId: { type: String },
    actorUsername: { type: String },

    // Reference to the related entity
    refId: { type: String },
    refType: {
      type: String,
      enum: ["post", "comment", "user", null],
      default: null,
    },

    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },

    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },

    emailSentAt: { type: Date },

    actionUrl: { type: String },
  },
  { timestamps: true },
);

// Compound index for the most common query: user's unread notifications, newest first
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// TTL: auto-delete notifications older than 30 days
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

notificationSchema.statics.markAllRead = function (userId) {
  return this.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
};

module.exports = mongoose.model("Notification", notificationSchema);
