const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

/* JWT authentication middleware for API Gateway. */
const authenticateToken = (redis) => async (req, res, next) => {
  if (req.method === "OPTIONS") return next();

  // Allow public read access to posts
  if (req.method === "GET" && req.originalUrl.startsWith("/api/posts"))
    return next();

  const authHeader = req.headers["authorization"];
  const token =
    authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    // Check token blacklist (logged out tokens)
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: "Token has been invalidated" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn("Token verification failed:", err.message);
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }
    return res.status(403).json({ error: "Invalid token" });
  }
};

module.exports = { authenticateToken };
