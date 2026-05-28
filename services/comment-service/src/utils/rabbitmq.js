const amqplib = require("amqplib");
const logger = require("./logger");

let channel;
let connection;

const EXCHANGE = "comment.events";

const connectRabbitMQ = async () => {
  let retries = 5;

  while (retries > 0) {
    try {
      connection = await amqplib.connect(
        process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672",
      );

      channel = await connection.createChannel();

      await channel.assertExchange(EXCHANGE, "topic", {
        durable: true,
      });

      logger.info("RabbitMQ connected (comment-service)");

      connection.on("error", (err) => {
        logger.error("RabbitMQ connection error:", err);
      });

      connection.on("close", () => {
        logger.warn("RabbitMQ connection closed");
      });

      return channel;
    } catch (err) {
      retries--;

      logger.warn(`RabbitMQ connection failed. Retrying... (${retries} left)`);

      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  throw new Error("Failed to connect to RabbitMQ");
};

const publishEvent = async (routingKey, payload) => {
  try {
    if (!channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    channel.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(
        JSON.stringify({
          ...payload,
          timestamp: new Date().toISOString(),
        }),
      ),
      {
        persistent: true,
        contentType: "application/json",
      },
    );

    logger.info(`Event published: ${routingKey}`);
  } catch (err) {
    logger.error("Failed to publish event:", err);
  }
};

module.exports = {
  connectRabbitMQ,
  publishEvent,
};
