const Redis = require("ioredis");
const logger = require("./logger");

let client;
let isConnected = false;

const connectRedis = async () => {
  if (client && isConnected) return client;

  client = new Redis({
    host: process.env.REDIS_HOST || "redis",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  client.on("connect", () => {
    logger.info("Redis connecting...");
  });

  client.on("ready", () => {
    isConnected = true;
    logger.info("Redis READY (post-service)");
  });

  client.on("error", (err) => {
    isConnected = false;
    logger.error("Redis error:", err.message);
  });

  await client.ping();

  return client;
};

const getRedis = () => {
  if (!client || !isConnected) {
    throw new Error(
      "Redis not ready. Did you call connectRedis() in index.js?",
    );
  }
  return client;
};

module.exports = { connectRedis, getRedis };
