const amqplib = require("amqplib");
const axios = require("axios");
const Notification = require("../models/Notification");
const { sendEmail } = require("../utils/mailer");
const logger = require("../utils/logger");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const POST_SERVICE = process.env.POST_SERVICE_URL || "http://post-service:3002";
const QUEUE = "notification.worker";

let channel;
let reconnecting = false;

// Event Handlers
async function handleUserRegistered(payload) {
  const { userId, email, username, verifyToken } = payload;
  const verifyUrl = `${FRONTEND_URL}/verify-email/${verifyToken}`;

  await Notification.create({
    userId,
    type: "welcome",
    title: `Welcome to InkSpire, ${username}!`,
    body: "Your account is ready. Start writing your first post!",
    actionUrl: "/",
    channels: { inApp: true, email: true },
  });

  await Notification.create({
    userId,
    type: "email_verify",
    title: "Please verify your email",
    body: "Click the link in your email to verify your account.",
    actionUrl: verifyUrl,
    channels: { inApp: true, email: true },
  });

  await sendEmail({
    to: email,
    subject: `Welcome to InkSpire, ${username}!`,
    templateName: "welcome",
    templateData: { username, verifyUrl },
  }).catch((err) => logger.error("Welcome email failed:", err.message));

  logger.info(`Handled user.registered for userId=${userId}`);
}

async function handlePasswordReset(payload) {
  const { email, resetToken } = payload;
  const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}`;

  await sendEmail({
    to: email,
    subject: "Reset your InkSpire password",
    templateName: "passwordReset",
    templateData: { resetUrl },
  }).catch((err) => logger.error("Password reset email failed:", err.message));

  logger.info(`Handled password reset for ${email}`);
}

async function handlePostPublished(payload) {
  const { postId, title, authorId, slug, excerpt } = payload;
  const postUrl = `${FRONTEND_URL}/posts/${slug}`;

  await Notification.create({
    userId: authorId,
    type: "post_published",
    title: "Your post is live!",
    body: `"${title}" has been published successfully.`,
    data: { postId, slug },
    actionUrl: postUrl,
    refId: postId,
    refType: "post",
    channels: { inApp: true },
  });

  logger.info(`Handled post.published for postId=${postId}`);
}

async function handleCommentCreated(payload) {
  const { commentId, postId, postOwnerId, authorId, authorUsername, content } =
    payload;

  // Only notify if commenter is NOT the post owner
  if (!postOwnerId || postOwnerId === authorId) {
    logger.info(
      `Skipping comment notification: commenter is post owner or postOwnerId missing`,
    );
    return;
  }

  const truncatedContent =
    content.length > 100 ? content.substring(0, 100) + "..." : content;

  await Notification.create({
    userId: postOwnerId,
    type: "comment_on_post",
    title: `${authorUsername} commented on your post`,
    body: truncatedContent,
    actorId: authorId,
    actorUsername: authorUsername,
    refId: postId,
    refType: "post",
    actionUrl: `/posts/${postId}#comment-${commentId}`,
    channels: { inApp: true },
  });

  logger.info(`Comment notification created for postOwner=${postOwnerId}`);
}

async function handleCommentCountIncrement(payload) {
  const { postId } = payload;
  try {
    await axios.patch(`${POST_SERVICE}/posts/${postId}/comment-count`, {
      delta: 1,
    });
  } catch (err) {
    logger.warn(
      `Failed to increment comment_count for post ${postId}:`,
      err.message,
    );
  }
}

async function handleCommentCountDecrement(payload) {
  const { postId } = payload;
  try {
    await axios.patch(`${POST_SERVICE}/posts/${postId}/comment-count`, {
      delta: -1,
    });
  } catch (err) {
    logger.warn(
      `Failed to decrement comment_count for post ${postId}:`,
      err.message,
    );
  }
}

// Bindings
const BINDINGS = [
  {
    exchange: "user.events",
    pattern: "user.registered",
    handler: handleUserRegistered,
  },
  {
    exchange: "user.events",
    pattern: "user.passwordResetRequested",
    handler: handlePasswordReset,
  },
  {
    exchange: "post.events",
    pattern: "post.published",
    handler: handlePostPublished,
  },
  {
    exchange: "comment.events",
    pattern: "comment.created",
    handler: handleCommentCreated,
  },
  {
    exchange: "comment.events",
    pattern: "comment.count.increment",
    handler: handleCommentCountIncrement,
  },
  {
    exchange: "comment.events",
    pattern: "comment.count.decrement",
    handler: handleCommentCountDecrement,
  },
];

// Worker setup
const startWorker = async () => {
  const url = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
  let retries = 10;

  while (retries-- > 0) {
    try {
      const conn = await amqplib.connect(url);
      channel = await conn.createChannel();
      channel.prefetch(10);

      const exchanges = [...new Set(BINDINGS.map((b) => b.exchange))];
      for (const exchange of exchanges) {
        await channel.assertExchange(exchange, "topic", { durable: true });
      }

      await channel.assertExchange("dlx.notifications", "topic", {
        durable: true,
      });
      await channel.assertQueue("dead.notifications", { durable: true });
      await channel.bindQueue("dead.notifications", "dlx.notifications", "#");

      await channel.assertQueue(QUEUE, {
        durable: true,
        arguments: { "x-dead-letter-exchange": "dlx.notifications" },
      });

      for (const { exchange, pattern } of BINDINGS) {
        await channel.bindQueue(QUEUE, exchange, pattern);
        logger.info(`Bound ${QUEUE} ← ${exchange} [${pattern}]`);
      }

      channel.consume(
        QUEUE,
        async (msg) => {
          if (!msg) return;
          const routingKey = msg.fields.routingKey;

          try {
            const payload = JSON.parse(msg.content.toString());
            logger.info(`Processing event: ${routingKey}`);

            const binding = BINDINGS.find((b) => b.pattern === routingKey);
            if (binding) {
              await binding.handler(payload);
            } else {
              logger.warn(`No handler for routing key: ${routingKey}`);
            }

            channel.ack(msg);
          } catch (err) {
            logger.error(
              `Message processing failed [${routingKey}]:`,
              err.message,
            );

            // Retry up to 3× with exponential back-off; then dead-letter
            const retryCount =
              (msg.properties.headers?.["x-retry-count"] || 0) + 1;
            if (retryCount < 3) {
              setTimeout(() => {
                try {
                  channel.nack(msg, false, true);
                } catch (e) {
                  logger.warn("nack failed:", e.message);
                }
              }, retryCount * 2000);
            } else {
              channel.nack(msg, false, false); // → DLQ
            }
          }
        },
        { noAck: false },
      );

      logger.info("Notification worker started — consuming events");

      conn.on("error", (err) => {
        logger.error("RabbitMQ worker connection error:", err.message);
        channel = null;
        scheduleReconnect();
      });
      conn.on("close", () => {
        logger.warn("RabbitMQ worker connection closed");
        channel = null;
        scheduleReconnect();
      });

      reconnecting = false;
      return;
    } catch (err) {
      logger.warn(
        `RabbitMQ worker connect failed (${retries} retries left):`,
        err.message,
      );
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  throw new Error("Notification worker failed to connect after retries");
};

const scheduleReconnect = () => {
  if (reconnecting) return;
  reconnecting = true;
  setTimeout(async () => {
    try {
      await startWorker();
    } catch (err) {
      logger.error("Worker reconnect failed:", err.message);
      reconnecting = false;
      scheduleReconnect();
    }
  }, 5000);
};

module.exports = { startWorker };
