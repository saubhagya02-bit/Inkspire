const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

const authenticateToken = (req, res, next) => {
  if (req.method === "OPTIONS") return next();

  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    req.headers["x-user-id"] = String(decoded.id);
    req.headers["x-user-role"] = decoded.role;
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
