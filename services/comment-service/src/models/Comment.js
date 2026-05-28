const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    type: {
      type: String,
      enum: ["like", "love", "laugh", "sad", "angry"],
      default: "like",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const commentSchema = new mongoose.Schema(
  {
    postId: { type: String, required: true, index: true },
    authorId: { type: String, required: true },
    authorUsername: { type: String, required: true },
    authorAvatar: { type: String },
    content: { type: String, required: true, maxlength: 5000 },
    contentHtml: { type: String },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    depth: { type: Number, default: 0, max: 3 },
    reactions: [reactionSchema],
    reactionCounts: {
      like: { type: Number, default: 0 },
      love: { type: Number, default: 0 },
      laugh: { type: Number, default: 0 },
      sad: { type: Number, default: 0 },
      angry: { type: Number, default: 0 },
    },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    isApproved: { type: Boolean, default: true },
    isPinned: { type: Boolean, default: false },
    replyCount: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index({ postId: 1, parentId: 1 });
commentSchema.index({ authorId: 1 });

function excludeDeleted(next) {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: false });
  }
  next();
}

commentSchema.pre("find", excludeDeleted);
commentSchema.pre("findOne", excludeDeleted);
commentSchema.pre("findOneAndUpdate", excludeDeleted);

const Comment = mongoose.model("Comment", commentSchema);
module.exports = Comment;
