const Redis = require("ioredis");
const logger = require("./logger");

let client;

const connectRedis = async () => {
  client = new Redis({
    host: process.env.REDIS_HOST || "redis",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (t) => Math.min(t * 50, 2000),
  });

  client.on("connect", () =>
    logger.info("Redis connected (notification-service)"),
  );

  client.on("error", (err) =>
    logger.error("Redis error (notification-service):", err.message),
  );

  await client.ping();
  return client;
};

const getRedis = () => {
  if (!client) throw new Error("Redis not initialized");
  return client;
};

module.exports = { connectRedis, getRedis };
