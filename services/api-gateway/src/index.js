require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const axios = require("axios");
const Redis = require("ioredis");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { createProxyMiddleware } = require("http-proxy-middleware");

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

//  Services
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || "http://auth-service:3001",
  posts: process.env.POST_SERVICE_URL || "http://post-service:3002",
  comments: process.env.COMMENT_SERVICE_URL || "http://comment-service:3003",
  media: process.env.MEDIA_SERVICE_URL || "http://media-service:3004",
  notifications:
    process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3005",
};

// Global middleware
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

app.use(
  "/api/media",
  async (req, res, next) => {
    // inline auth check (mirrors requireAuth) so req.user is available
    // for the proxy's header-injection step below
    const header = req.headers["authorization"];
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Access token required" });
    try {
      const blacklisted = await redis
        .get("blacklist:" + token)
        .catch(() => null);
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
  },
  createProxyMiddleware({
    target: process.env.MEDIA_SERVICE_URL || "http://media-service:3004",
    changeOrigin: true,
    pathRewrite: { "^/api/media": "" },
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.user) {
          proxyReq.setHeader("x-user-id", String(req.user.id));
          proxyReq.setHeader("x-user-role", req.user.role || "user");
          proxyReq.setHeader("x-user-email", req.user.email || "");
          proxyReq.setHeader("x-user-username", req.user.username || "");
        }
      },
      error: (err, req, res) => {
        logger.error("Media proxy error:", err.message);
        res.status(502).json({ error: "Media service unavailable" });
      },
    },
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// requestId before all routes
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

const optionalAuth = async (req, res, next) => {
  const header = req.headers["authorization"];
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    const blacklisted = await redis.get("blacklist:" + token).catch(() => null);
    if (!blacklisted) req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {}
  next();
};

// Proxy
const forward = (baseUrl, stripPrefix) => async (req, res) => {
  const suffix = req.originalUrl.startsWith(stripPrefix)
    ? req.originalUrl.slice(stripPrefix.length) || "/"
    : req.originalUrl;

  const target = baseUrl + suffix;
  logger.info(`${req.method} ${req.originalUrl} → ${target}`);

  try {
    const headers = {
      "x-request-id": req.requestId,
    };

    if (req.headers["content-type"]) {
      headers["content-type"] = req.headers["content-type"];
    }

    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"];
    }

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
// Auth service routes
app.all("/api/auth/register", forward(SERVICES.auth, "/api/auth"));
app.all("/api/auth/login", forward(SERVICES.auth, "/api/auth"));
app.all("/api/auth/refresh", forward(SERVICES.auth, "/api/auth"));
app.all("/api/auth/logout", forward(SERVICES.auth, "/api/auth"));
app.all("/api/auth/verify-email/*", forward(SERVICES.auth, "/api/auth"));
app.all("/api/auth/forgot-password", forward(SERVICES.auth, "/api/auth"));
app.all("/api/auth/reset-password/*", forward(SERVICES.auth, "/api/auth"));
app.all("/api/auth/oauth/*", forward(SERVICES.auth, "/api/auth"));

app.all("/api/auth/users/*", requireAuth, forward(SERVICES.auth, "/api/auth"));
app.all("/api/auth/2fa/*", requireAuth, forward(SERVICES.auth, "/api/auth"));

// Posts — public reads, auth required for writes
app.get("/api/posts", optionalAuth, forward(SERVICES.posts, "/api/posts"));
app.get("/api/posts/*", optionalAuth, forward(SERVICES.posts, "/api/posts"));
app.all("/api/posts", requireAuth, forward(SERVICES.posts, "/api/posts"));
app.all("/api/posts/*", requireAuth, forward(SERVICES.posts, "/api/posts"));

// Comments — public reads, auth for writes
app.get("/api/comments/*", forward(SERVICES.comments, "/api/comments"));
app.all(
  "/api/comments/*",
  requireAuth,
  forward(SERVICES.comments, "/api/comments"),
);

// Notifications — all require auth
app.all(
  "/api/notifications",
  requireAuth,
  forward(SERVICES.notifications, "/api/notifications"),
);
app.all(
  "/api/notifications/*",
  requireAuth,
  forward(SERVICES.notifications, "/api/notifications"),
);

// 404
app.use((req, res) =>
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }),
);

app.listen(PORT, () => logger.info(`API Gateway running on port ${PORT}`));
module.exports = app;
