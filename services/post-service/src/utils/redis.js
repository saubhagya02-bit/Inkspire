const Redis = require("ioredis");
const logger = require("./logger");

let client;

const connectRedis = async () => {
  if (client) return client;

  client = new Redis({
    host: process.env.REDIS_HOST || "redis",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  client.on("connect", () => logger.info("Redis connecting... (post-service)"));
  client.on("ready", () => logger.info("Redis ready (post-service)"));
  client.on("error", (err) => logger.error("Redis error:", err.message));
  client.on("close", () => logger.warn("Redis connection closed"));

  await client.ping();
  return client;
};

const getRedis = () => {
  if (!client) {
    throw new Error(
      "Redis not initialized — call connectRedis() first in index.js",
    );
  }
  return client;
};

module.exports = { connectRedis, getRedis };
