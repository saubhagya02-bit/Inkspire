require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const passport = require("passport");

const logger = require("./utils/logger");
const { connectDB } = require("./utils/database");
const { connectRedis } = require("./utils/redis");
const { connectRabbitMQ } = require("./utils/rabbitmq");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const { errorHandler } = require("./middleware/errorHandler");

require("./utils/passport");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "auth-service",
    timestamp: new Date().toISOString(),
  }),
);

app.use("/", authRoutes);
app.use("/users", userRoutes);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Auth Service running on port ${PORT}`);
});

const startConnections = async () => {
  let dbConnected = false;
  while (!dbConnected) {
    try {
      await connectDB();
      dbConnected = true;
    } catch (err) {
      logger.error(
        "PostgreSQL connection failed, retrying in 3s...",
        err.message,
      );
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // Redis — required, retry forever
  let redisConnected = false;
  while (!redisConnected) {
    try {
      await connectRedis();
      redisConnected = true;
    } catch (err) {
      logger.error("Redis connection failed, retrying in 3s...", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // RabbitMQ — optional for basic auth to work, keep retrying in background
  const connectMQWithRetry = async () => {
    while (true) {
      try {
        await connectRabbitMQ();
        logger.info("RabbitMQ connected");
        return;
      } catch (err) {
        logger.warn("RabbitMQ not ready, retrying in 5s...");
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  };
  connectMQWithRetry();
};

startConnections();

module.exports = app;
