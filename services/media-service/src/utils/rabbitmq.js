const amqplib = require("amqplib");
const logger = require("./logger");

let channel;
let reconnecting = false;

const connectRabbitMQ = async () => {
  let retries = 5;

  while (retries-- > 0) {
    try {
      const conn = await amqplib.connect(
        process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672",
      );
      channel = await conn.createChannel();
      await channel.assertExchange("media.events", "topic", { durable: true });
      logger.info("RabbitMQ connected (media-service)");

      conn.on("error", (err) => {
        logger.error("RabbitMQ connection error:", err.message);
        channel = null;
        scheduleReconnect();
      });
      conn.on("close", () => {
        logger.warn("RabbitMQ connection closed");
        channel = null;
        scheduleReconnect();
      });

      reconnecting = false;
      return;
    } catch (err) {
      logger.error("RabbitMQ connection failed:", err.message);
      if (retries === 0) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
};

const scheduleReconnect = () => {
  if (reconnecting) return;
  reconnecting = true;
  setTimeout(async () => {
    try {
      await connectRabbitMQ();
    } catch (err) {
      logger.error("RabbitMQ reconnect failed:", err.message);
      reconnecting = false;
      scheduleReconnect();
    }
  }, 5000);
};

const publishEvent = async (routingKey, payload) => {
  try {
    if (!channel) {
      logger.warn(`RabbitMQ not ready, skipping event: ${routingKey}`);
      return;
    }
    channel.publish(
      "media.events",
      routingKey,
      Buffer.from(
        JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
      ),
      { persistent: true, contentType: "application/json" },
    );
    logger.info(`Event published: ${routingKey}`);
  } catch (err) {
    logger.error("Failed to publish event:", err.message);
  }
};

module.exports = { connectRabbitMQ, publishEvent };
