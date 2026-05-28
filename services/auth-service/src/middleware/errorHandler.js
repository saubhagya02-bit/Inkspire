const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  logger.error("Auth service error:", {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
  });

  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message;

  res.status(err.status || 500).json({
    error: message,
    requestId: req.requestId || null,
  });
};

module.exports = { errorHandler };
