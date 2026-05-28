require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");

const logger = require("./utils/logger");
const { connectRabbitMQ } = require("./utils/rabbitmq");
const mediaRoutes = require("./routes/media");

const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "media-service",
    timestamp: new Date().toISOString(),
  }),
);
app.use("/", mediaRoutes);

app.use((err, req, res, next) => {
  logger.error("Media service error:", err);
  if (err.message?.includes("not allowed"))
    return res.status(415).json({ error: err.message });
  if (err.message?.includes("File too large"))
    return res.status(413).json({ error: "File too large" });
  res.status(500).json({ error: "Internal server error" });
});

//  Startup
(async () => {
  let mongoConnected = false;
  while (!mongoConnected) {
    try {
      await mongoose.connect(
        process.env.MONGO_URI || "mongodb://mongo:27017/inkspire",
      );
      logger.info("MongoDB connected (media-service)");
      mongoConnected = true;
    } catch (err) {
      logger.error("MongoDB connection failed, retrying in 3s...", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // RabbitMQ — non-blocking, retry in background
  connectRabbitMQ().catch((err) =>
    logger.warn("RabbitMQ initial connection failed:", err.message),
  );

  app.listen(PORT, () => logger.info(`Media Service running on port ${PORT}`));
})();

module.exports = app;
