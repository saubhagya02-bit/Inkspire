require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const axios = require("axios");
const Redis = require("ioredis");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const logger = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 3000;

// Redis
const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: 6379,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});
redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.warn("Redis warn:", err.message));

// Service map
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || "http://auth-service:3001",
  posts: process.env.POST_SERVICE_URL || "http://post-service:3002",
  comments: process.env.COMMENT_SERVICE_URL || "http://comment-service:3003",
  media: process.env.MEDIA_SERVICE_URL || "http://media-service:3004",
  notifications:
    process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3005",
};

// Middleware
app.set("trust proxy", 1);
app.use(helmet());

const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.FRONTEND_URL ||
  "http://localhost:5173"
).split(",");
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.requestId = req.headers["x-request-id"] || uuidv4();
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

// Auth middleware
const requireAuth = async (req, res, next) => {
  const header = req.headers["authorization"];
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Access token required" });
  try {
    const blacklisted = await redis.get("blacklist:" + token).catch(() => null);
    if (blacklisted)
      return res.status(401).json({ error: "Token invalidated" });
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({
      error:
        err.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
      code:
        err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
    });
  }
};

// Proxy helper
const forward = (baseUrl, stripPrefix) => async (req, res) => {
  const suffix = req.originalUrl.startsWith(stripPrefix)
    ? req.originalUrl.slice(stripPrefix.length) || "/"
    : req.originalUrl;

  const target = baseUrl + suffix;
  logger.info(`Forwarding: ${req.method} ${req.originalUrl} → ${target}`);

  try {
    const headers = {
      "content-type": req.headers["content-type"] || "application/json",
      "x-request-id": req.requestId,
    };
    if (req.user) {
      headers["x-user-id"] = String(req.user.id);
      headers["x-user-role"] = req.user.role;
      headers["x-user-email"] = req.user.email;
      headers["x-user-username"] = req.user.username || "";
    }

    const response = await axios({
      method: req.method,
      url: target,
      headers,
      data: ["POST", "PUT", "PATCH"].includes(req.method)
        ? req.body
        : undefined,
      params: req.query,
      timeout: 10000,
      validateStatus: () => true,
    });

    res.status(response.status).json(response.data);
  } catch (err) {
    logger.error("Proxy error:", err.message);
    res
      .status(502)
      .json({ error: "Service unavailable", target, detail: err.message });
  }
};

// Health
app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }),
);

// Routes
app.all("/api/auth/*", forward(SERVICES.auth, "/api/auth"));

// Posts — public reads, auth required for writes
app.get("/api/posts", forward(SERVICES.posts, "/api/posts"));
app.get("/api/posts/*", forward(SERVICES.posts, "/api/posts"));
app.all("/api/posts", requireAuth, forward(SERVICES.posts, "/api/posts"));
app.all("/api/posts/*", requireAuth, forward(SERVICES.posts, "/api/posts"));

app.get("/api/comments/*", forward(SERVICES.comments, "/api/comments"));

app.all(
  "/api/comments/*",
  requireAuth,
  forward(SERVICES.comments, "/api/comments"),
);
app.all("/api/media/*", requireAuth, forward(SERVICES.media, "/api/media"));
app.all(
  "/api/notifications/*",
  requireAuth,
  forward(SERVICES.notifications, "/api/notifications"),
);

// 404 catch-all
app.use((req, res) =>
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }),
);

app.listen(PORT, () => logger.info("API Gateway running on port " + PORT));
module.exports = app;
