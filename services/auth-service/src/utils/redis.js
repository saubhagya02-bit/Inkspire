const Redis = require("ioredis");
const logger = require("./logger");

let client;

const connectRedis = async () => {
  client = new Redis({
    host: process.env.REDIS_HOST || "redis",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
  });

  client.on("connect", () => logger.info("Redis connected (auth-service)"));
  client.on("error", (err) => logger.error("Redis error:", err));

  await client.ping();
  return client;
};

const getRedis = () => {
  if (!client) throw new Error("Redis not initialized");
  return client;
};

// Helper methods
const setex = (key, seconds, value) => client.setex(key, seconds, value);
const get = (key) => {
  if (!client) throw new Error("Redis not initialized");
  return client.get(key);
};
const del = (key) => client.del(key);
const exists = (key) => client.exists(key);

module.exports = {
  connectRedis,
  getRedis,
  redis: {
    setex,
    get,
    del,
    exists,
  },
};
