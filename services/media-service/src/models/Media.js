const mongoose = require("mongoose");

const thumbnailSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      enum: ["sm", "md", "lg"],
    },

    width: Number,

    height: Number,

    url: String,

    s3Key: String,
  },
  {
    _id: false,
  },
);

const usedInSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["post", "comment", "profile"],
      required: true,
    },

    refId: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const mediaSchema = new mongoose.Schema(
  {
    uploaderId: {
      type: String,
      required: true,
      index: true,
    },

    originalName: {
      type: String,
      required: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      required: true,
    },

    s3Key: {
      type: String,
      required: true,
      unique: true,
    },

    s3Bucket: {
      type: String,
      required: true,
    },

    url: {
      type: String,
      required: true,
    },

    cdnUrl: {
      type: String,
    },

    // Image metadata
    width: Number,

    height: Number,

    format: String,

    // Generated thumbnails
    thumbnails: [thumbnailSchema],

    // Metadata
    altText: {
      type: String,
      trim: true,
      maxlength: 300,
    },

    caption: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    isPublic: {
      type: Boolean,
      default: true,
    },

    // Reference tracking
    usedIn: [usedInSchema],
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
    },
  },
);

mediaSchema.index({
  uploaderId: 1,
  createdAt: -1,
});

mediaSchema.index({
  mimeType: 1,
});

mediaSchema.index({
  tags: 1,
});

// Model

const Media = mongoose.model("Media", mediaSchema);

module.exports = Media;
