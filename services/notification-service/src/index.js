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

// Health
app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "notification-service",
    timestamp: new Date().toISOString(),
  }),
);

// Routes
app.use("/", notificationRoutes);

// Error handler
app.use((err, req, res, next) => {
  logger.error("Notification service error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// Startup with retry loops
(async () => {
  // MongoDB — retry until ready
  let mongoOk = false;
  while (!mongoOk) {
    try {
      await mongoose.connect(
        process.env.MONGO_URI || "mongodb://mongo:27017/inkspire_notifications",
      );
      logger.info("MongoDB connected (notification-service)");
      mongoOk = true;
    } catch (err) {
      logger.error("MongoDB failed, retrying in 3s...", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // Redis — retry until ready
  let redisOk = false;
  while (!redisOk) {
    try {
      await connectRedis();
      redisOk = true;
    } catch (err) {
      logger.error("Redis failed, retrying in 3s...", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  startWorker().catch((err) =>
    logger.error("Worker failed to start:", err.message),
  );

  app.listen(PORT, () =>
    logger.info(`Notification Service running on port ${PORT}`),
  );
})();

module.exports = app;
