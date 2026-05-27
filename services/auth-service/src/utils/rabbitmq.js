const amqplib = require("amqplib");
const logger = require("./logger");

let channel;
let connection;
let reconnecting = false;

const EXCHANGES = {
  USER_EVENTS: "user.events",
};

const QUEUES = {
  NOTIFICATION: "auth.notification.queue",
};

const connectRabbitMQ = async () => {
  const url = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
  let retries = 5;

  while (retries > 0) {
    try {
      connection = await amqplib.connect(url);
      channel = await connection.createChannel();

      await channel.assertExchange(EXCHANGES.USER_EVENTS, "topic", {
        durable: true,
      });

      await channel.assertQueue(QUEUES.NOTIFICATION, { durable: true });
      await channel.bindQueue(
        QUEUES.NOTIFICATION,
        EXCHANGES.USER_EVENTS,
        "user.#",
      );

      logger.info("RabbitMQ connected (auth-service)");

      connection.on("error", (err) => {
        logger.error("RabbitMQ connection error:", err);
        setTimeout(connectRabbitMQ, 5000);
      });

      return channel;
    } catch (err) {
      retries--;
      logger.warn(`RabbitMQ connection failed, retrying... (${retries} left)`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("Failed to connect to RabbitMQ after retries");
};

const publishEvent = async (routingKey, payload) => {
  try {
    if (!channel) throw new Error("RabbitMQ channel not initialized");
    channel.publish(
      EXCHANGES.USER_EVENTS,
      routingKey,
      Buffer.from(
        JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
      ),
      { persistent: true, contentType: "application/json" },
    );
    logger.info(`Event published: ${routingKey}`);
  } catch (err) {
    logger.error("Failed to publish event:", err);
  }
};

module.exports = { connectRabbitMQ, publishEvent, EXCHANGES, QUEUES };
