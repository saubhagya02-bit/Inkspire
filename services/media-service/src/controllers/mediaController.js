const sharp = require("sharp");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

const Media = require("../models/Media");
const {
  upload,
  s3Client,
  BUCKET,
  checkFileSize,
  uploadBufferToS3,
  deleteFromS3,
  getPublicUrl,
} = require("../utils/s3");
const logger = require("../utils/logger");

const THUMBNAIL_SIZES = {
  sm: { width: 150, height: 150 },
  md: { width: 400, height: 300 },
  lg: { width: 800, height: 600 },
};

// Thumbnail generation
const generateThumbnails = async (buffer, originalKey) => {
  const thumbnails = [];
  const basePath = originalKey.replace(/\.[^/.]+$/, "");

  for (const [size, dimensions] of Object.entries(THUMBNAIL_SIZES)) {
    try {
      const thumbBuffer = await sharp(buffer)
        .resize(dimensions.width, dimensions.height, {
          fit: "cover",
          position: "center",
        })
        .webp({ quality: 80 })
        .toBuffer();

      const thumbKey = `${basePath}_${size}.webp`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: "image/webp",
        }),
      );

      thumbnails.push({
        size,
        width: dimensions.width,
        height: dimensions.height,
        url: getPublicUrl(thumbKey),
        s3Key: thumbKey,
      });
    } catch (err) {
      logger.warn(`Thumbnail ${size} generation failed: ${err.message}`);
    }
  }
  return thumbnails;
};

// Tag normalizer
const normalizeTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags))
    return tags.map((t) => String(t).trim()).filter(Boolean);
  return String(tags)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
};

const errorBody = (fallbackMessage, err) => ({
  error: process.env.NODE_ENV === "production" ? fallbackMessage : err.message,
});

// Upload single file
const uploadFile = [
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      checkFileSize(req.file);

      const uploaderId = req.headers["x-user-id"];
      const { altText, caption, tags } = req.body;
      const file = req.file;

      // Upload original to S3/MinIO
      const { key, location } = await uploadBufferToS3(
        file.buffer,
        file.mimetype,
        file.originalname,
        uploaderId,
      );

      let metadata = { width: null, height: null, format: null };
      let thumbnails = [];

      if (
        file.mimetype.startsWith("image/") &&
        file.mimetype !== "image/svg+xml"
      ) {
        try {
          const imgMeta = await sharp(file.buffer).metadata();
          metadata = {
            width: imgMeta.width,
            height: imgMeta.height,
            format: imgMeta.format,
          };
          thumbnails = await generateThumbnails(file.buffer, key);
        } catch (err) {
          logger.warn(`Image processing failed: ${err.message}`);
        }
      }

      const media = await Media.create({
        uploaderId,
        originalName: file.originalname,
        fileName: key.split("/").pop(),
        mimeType: file.mimetype,
        size: file.size,
        s3Key: key,
        s3Bucket: BUCKET,
        url: location,
        ...metadata,
        thumbnails,
        altText: altText || "",
        caption: caption || "",
        tags: normalizeTags(tags),
      });

      res.status(201).json(media);
    } catch (err) {
      logger.error("Upload error:", { message: err.message, stack: err.stack });
      res.status(500).json(errorBody("Upload failed", err));
    }
  },
];

// Upload multiple files
const uploadMultiple = [
  upload.array("files", 10),
  async (req, res) => {
    try {
      if (!req.files?.length)
        return res.status(400).json({ error: "No files uploaded" });

      req.files.forEach(checkFileSize);

      const uploaderId = req.headers["x-user-id"];

      const savedMedia = await Promise.all(
        req.files.map(async (file) => {
          const { key, location } = await uploadBufferToS3(
            file.buffer,
            file.mimetype,
            file.originalname,
            uploaderId,
          );
          return Media.create({
            uploaderId,
            originalName: file.originalname,
            fileName: key.split("/").pop(),
            mimeType: file.mimetype,
            size: file.size,
            s3Key: key,
            s3Bucket: BUCKET,
            url: location,
          });
        }),
      );

      res.status(201).json(savedMedia);
    } catch (err) {
      logger.error("Multi-upload error:", {
        message: err.message,
        stack: err.stack,
      });
      res.status(500).json(errorBody("Upload failed", err));
    }
  },
];

// Get my media
const getMyMedia = async (req, res) => {
  const uploaderId = req.headers["x-user-id"];
  const { page = 1, limit = 20, type } = req.query;

  try {
    const filter = { uploaderId };

    if (type === "image") filter.mimeType = { $regex: /^image\// };
    if (type === "video") filter.mimeType = { $regex: /^video\// };
    if (type === "document") filter.mimeType = { $regex: /^application\// };

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const [media, total] = await Promise.all([
      Media.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Media.countDocuments(filter),
    ]);

    res.json({
      media,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    logger.error("Get media error:", err);
    res.status(500).json({ error: "Failed to fetch media" });
  }
};

// Delete media
const deleteMedia = async (req, res) => {
  const uploaderId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];
  const { id } = req.params;

  try {
    const media = await Media.findById(id);
    if (!media) return res.status(404).json({ error: "Media not found" });
    if (media.uploaderId !== uploaderId && userRole !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const deleteResults = await Promise.allSettled([
      deleteFromS3(media.s3Key),
      ...(media.thumbnails || []).map((thumb) => deleteFromS3(thumb.s3Key)),
    ]);
    deleteResults.forEach((result, i) => {
      if (result.status === "rejected") {
        logger.warn(`S3 delete failed for item ${i}:`, result.reason?.message);
      }
    });

    await Media.findByIdAndDelete(id);
    res.json({ message: "Media deleted" });
  } catch (err) {
    logger.error("Delete media error:", err);
    res.status(500).json({ error: "Failed to delete media" });
  }
};

// Update media
const updateMedia = async (req, res) => {
  const uploaderId = req.headers["x-user-id"];
  const { id } = req.params;
  const { altText, caption, tags } = req.body;

  try {
    const media = await Media.findOneAndUpdate(
      { _id: id, uploaderId },
      { altText, caption, tags: normalizeTags(tags) },
      { new: true },
    );
    if (!media)
      return res
        .status(404)
        .json({ error: "Media not found or not authorized" });
    res.json(media);
  } catch (err) {
    logger.error("Update media error:", err);
    res.status(500).json({ error: "Failed to update media" });
  }
};

module.exports = {
  uploadFile,
  uploadMultiple,
  getMyMedia,
  deleteMedia,
  updateMedia,
};
