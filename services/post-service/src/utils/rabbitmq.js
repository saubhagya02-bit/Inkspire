const amqplib = require("amqplib");
const logger = require("./logger");

let channel;

const connectRabbitMQ = async () => {
  const conn = await amqplib.connect(
    process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672",
  );
  channel = await conn.createChannel();
  await channel.assertExchange("post.events", "topic", { durable: true });

  conn.on("error", () => {
    channel = null;
  });
  conn.on("close", () => {
    channel = null;
  });

  logger.info("RabbitMQ connected (post-service)");
};

const publishEvent = async (routingKey, payload) => {
  try {
    if (!channel) {
      logger.warn(`RabbitMQ not ready, skipping: ${routingKey}`);
      return;
    }
    channel.publish(
      "post.events",
      routingKey,
      Buffer.from(
        JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
      ),
      { persistent: true, contentType: "application/json" },
    );
  } catch (err) {
    logger.error("Publish failed:", err.message);
  }
};

module.exports = { connectRabbitMQ, publishEvent };
