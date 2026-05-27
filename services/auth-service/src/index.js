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
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  }),
);
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Health check
app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "auth-service",
    timestamp: new Date().toISOString(),
  }),
);

// Routes
app.use("/", authRoutes);
app.use("/users", userRoutes);

app.use(errorHandler);

// Startup
(async () => {
  try {
    await connectDB();
    await connectRedis();
    await connectRabbitMQ();
    app.listen(PORT, () => logger.info(`Auth Service running on port ${PORT}`));
  } catch (err) {
    logger.error("Failed to start auth service:", err);
    process.exit(1);
  }
})();

module.exports = app;
