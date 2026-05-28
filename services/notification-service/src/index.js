require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");

const logger = require("./utils/logger");
const { connectRedis } = require("./utils/redis");
const { startWorker } = require("./workers/notificationWorker");
const notificationRoutes = require("./routes/notifications");

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "notification-service",
    timestamp: new Date().toISOString(),
  }),
);
app.use("/", notificationRoutes);

app.use((err, req, res, next) => {
  logger.error("Notification service error:", err);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal server error" });
});

// Startup
(async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://mongo:27017/inkspire",
    );
    logger.info("MongoDB connected (notification-service)");

    await connectRedis();

    // Worker runs independently
    startWorker().catch((err) =>
      logger.error("Worker failed to start:", err.message),
    );

    app.listen(PORT, () =>
      logger.info(`Notification Service running on port ${PORT}`),
    );
  } catch (err) {
    logger.error("Service startup failed:", err);
    process.exit(1);
  }
})();

module.exports = app;
