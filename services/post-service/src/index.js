require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const logger = require("./utils/logger");
const { connectDB } = require("./utils/database");
const { connectRedis } = require("./utils/redis");
const { connectRabbitMQ } = require("./utils/rabbitmq");

const postRoutes = require("./routes/posts");
const categoryRoutes = require("./routes/categories");
const tagRoutes = require("./routes/tags");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json({ limit: "5mb" }));

// Health check (keep it lightweight)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "post-service",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/posts", postRoutes);
app.use("/categories", categoryRoutes);
app.use("/tags", tagRoutes);

// Error handler
app.use((err, req, res, next) => {
  logger.error("Post service error:", err);
  res.status(500).json({ error: "Internal server error" });
});

//START ONLY AFTER CONNECTIONS ARE READY
const start = async () => {
  try {
    logger.info("Starting post-service...");

    // DB (must be ready first)
    await connectDB();

    // Redis
    await connectRedis();

    // RabbitMQ (don’t block forever, but try)
    connectRabbitMQ().catch((err) =>
      logger.warn("RabbitMQ failed initially:", err.message),
    );

    app.listen(PORT, () => {
      logger.info(`🚀 Post Service running on port ${PORT}`);
    });
  } catch (err) {
    logger.error("Fatal startup error:", err);
    process.exit(1);
  }
};

start();

module.exports = app;
