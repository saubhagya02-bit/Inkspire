const {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const logger = require("./logger");

// S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // Local MinIO in development
  ...(process.env.NODE_ENV !== "production" && {
    endpoint: process.env.S3_ENDPOINT || "http://minio:9000",
    forcePathStyle: true,
  }),
});

const BUCKET = process.env.AWS_S3_BUCKET || "blog-cms-media";

const ALLOWED_TYPES = {
  "image/jpeg": "images",
  "image/png": "images",
  "image/gif": "images",
  "image/webp": "images",
  "image/svg+xml": "images",
  "video/mp4": "videos",
  "video/webm": "videos",
  "application/pdf": "documents",
  "text/plain": "documents",
};

const MAX_FILE_SIZE = {
  images: 10 * 1024 * 1024, // 10 MB
  videos: 100 * 1024 * 1024, // 100 MB
  documents: 20 * 1024 * 1024, // 20 MB
};

// File filter

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_TYPES[file.mimetype]) {
    return cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }

  const folder = ALLOWED_TYPES[file.mimetype];
  const maxSize = MAX_FILE_SIZE[folder];

  if (
    req.headers["content-length"] &&
    parseInt(req.headers["content-length"]) > maxSize
  ) {
    return cb(
      new Error(
        `File too large for type ${folder}. Max: ${maxSize / 1024 / 1024}MB`,
      ),
      false,
    );
  }

  cb(null, true);
};

// Multer-S3 storage
const storage = multerS3({
  s3: s3Client,
  bucket: BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const userId = req.headers["x-user-id"] || "anonymous";
    const folder = ALLOWED_TYPES[file.mimetype] || "misc";
    const ext = path.extname(file.originalname).toLowerCase();
    const key = `${folder}/${userId}/${uuidv4()}${ext}`;
    cb(null, key);
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

// S3 helpers
const deleteFromS3 = async (s3Key) => {
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }),
    );
    logger.info(`Deleted from S3: ${s3Key}`);
  } catch (err) {
    logger.error("S3 delete error:", err);
    throw err;
  }
};

const getPresignedUrl = async (s3Key, expiresIn = 3600) => {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  return getSignedUrl(s3Client, command, { expiresIn });
};

const getPublicUrl = (s3Key) => {
  if (process.env.CDN_URL) return `${process.env.CDN_URL}/${s3Key}`;
  if (process.env.NODE_ENV !== "production") {
    return `${process.env.S3_ENDPOINT || "http://localhost:9000"}/${BUCKET}/${s3Key}`;
  }
  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
};

module.exports = {
  upload,
  s3Client,
  BUCKET,
  ALLOWED_TYPES,
  deleteFromS3,
  getPresignedUrl,
  getPublicUrl,
};
