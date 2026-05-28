require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");

const logger = require("./utils/logger");
const { connectRedis } = require("./utils/redis");
const { connectRabbitMQ } = require("./utils/rabbitmq");
const commentRoutes = require("./routes/comments");

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "comment-service",
    timestamp: new Date().toISOString(),
  }),
);
app.use("/", commentRoutes);
app.use((err, req, res, next) => {
  logger.error("Comment service error:", err);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal server error" });
});

// Startup
(async () => {
  let mongoConnected = false;
  while (!mongoConnected) {
    try {
      await mongoose.connect(
        process.env.MONGO_URI || "mongodb://mongo:27017/inkspire",
      );

      logger.info("MongoDB connected (comment-service)");
      mongoConnected = true;
    } catch (err) {
      logger.error("MongoDB connection failed, retrying in 3s...", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  await connectRedis();

  // RabbitMQ — non-blocking
  connectRabbitMQ().catch((err) =>
    logger.warn("RabbitMQ initial connection failed:", err.message),
  );

  app.listen(PORT, () =>
    logger.info(`Comment Service running on port ${PORT}`),
  );
})();

module.exports = app;
