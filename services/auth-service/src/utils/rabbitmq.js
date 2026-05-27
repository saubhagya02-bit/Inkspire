const amqplib = require('amqplib');
const logger = require('./logger');

let channel;
let connection;

const EXCHANGES = {
  USER_EVENTS: 'user.events',
};

const connectRabbitMQ = async () => {
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
  
  connection = await amqplib.connect(url);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGES.USER_EVENTS, 'topic', { durable: true });

  connection.on('error', (err) => {
    logger.error('RabbitMQ connection error:', err.message);
    channel = null;
  });

  connection.on('close', () => {
    logger.warn('RabbitMQ connection closed');
    channel = null;
  });

  return channel;
};

const publishEvent = async (routingKey, payload) => {
  try {
    if (!channel) {
      logger.warn(`RabbitMQ not connected, skipping event: ${routingKey}`);
      return; 
    }
    channel.publish(
      EXCHANGES.USER_EVENTS,
      routingKey,
      Buffer.from(JSON.stringify({ ...payload, timestamp: new Date().toISOString() })),
      { persistent: true, contentType: 'application/json' }
    );
  } catch (err) {
    logger.error('Failed to publish event:', err.message);
  }
};

module.exports = { connectRabbitMQ, publishEvent, EXCHANGES };