const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

const authenticateToken = (req, res, next) => {
  const gatewayUserId = req.headers["x-user-id"];
  if (gatewayUserId) {
    req.user = {
      id: gatewayUserId,
      role: req.headers["x-user-role"] || "user",
      email: req.headers["x-user-email"] || "",
      username: req.headers["x-user-username"] || "",
    };
    return next();
  }

  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role || "user",
      email: decoded.email || "",
      username: decoded.username || "",
    };
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
