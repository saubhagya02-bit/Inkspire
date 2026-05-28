const amqplib = require("amqplib");
const Notification = require("../models/Notification");
const { sendEmail } = require("../utils/mailer");
const { getRedis } = require("../utils/redis");
const logger = require("../utils/logger");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

let connection;
let channel;

// Queue Bindings
const BINDINGS = [
  {
    exchange: "user.events",
    pattern: "user.registered",
    queue: "notif.user.registered",
  },
  {
    exchange: "user.events",
    pattern: "user.passwordResetRequested",
    queue: "notif.user.password_reset",
  },
  {
    exchange: "post.events",
    pattern: "post.published",
    queue: "notif.post.published",
  },
  {
    exchange: "comment.events",
    pattern: "comment.created",
    queue: "notif.comment.created",
  },
];

// Event Handlers
const handlers = {
  "user.registered": async (payload) => {
    const { userId, email, username, verifyToken } = payload;
    const verifyUrl = `${FRONTEND_URL}/verify-email/${verifyToken}`;

    await sendEmail({
      to: email,
      subject: "Verify your InkSpire account",
      templateName: "welcome",
      templateData: { username, verifyUrl },
    });

    await Notification.create({
      userId,
      type: "email_verified",
      title: "Welcome to InkSpire!",
      message: "Please check your email to verify your account.",
    });

    logger.info(`Welcome email sent to ${email}`);
  },

  "user.passwordResetRequested": async (payload) => {
    const { userId, email, resetToken } = payload;
    const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}`;

    await sendEmail({
      to: email,
      subject: "Reset your InkSpire password",
      templateName: "passwordReset",
      templateData: { resetUrl },
    });

    logger.info(`Password reset email sent to ${email}`);
  },

  "post.published": async (payload) => {
    const { postId, title, authorId, slug } = payload;
    const postUrl = `${FRONTEND_URL}/posts/${slug}`;

    await Notification.create({
      userId: authorId,
      type: "post_published",
      title: "Your post is live!",
      message: `"${title}" has been published successfully.`,
      link: `/posts/${slug}`,
      refId: postId,
      refType: "post",
    });

    const redis = getRedis();
    await redis.publish(
      `user:${authorId}:notifications`,
      JSON.stringify({
        type: "post_published",
        title: "Your post is live!",
        postUrl,
      }),
    );

    logger.info(`Post published notification created for author ${authorId}`);
  },

  "comment.created": async (payload) => {
    const { commentId, postId, authorId, authorUsername, content } = payload;

    await Notification.create({
      userId: authorId,
      type: "comment_on_post",
      title: `${authorUsername} commented on your post`,
      message: content.substring(0, 100) + (content.length > 100 ? "..." : ""),
      actorId: authorId,
      actorUsername: authorUsername,
      link: `/posts/${postId}#comment-${commentId}`,
      refId: postId,
      refType: "post",
    });

    // Real-time via Redis pub/sub
    const redis = getRedis();
    await redis.publish(
      `user:${authorId}:notifications`,
      JSON.stringify({
        type: "comment_on_post",
        title: `New comment from ${authorUsername}`,
      }),
    );

    logger.info(`Comment notification created for post ${postId}`);
  },
};

// Connect
const startConsumer = async () => {
  const url = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
  let retries = 10;

  while (retries-- > 0) {
    try {
      connection = await amqplib.connect(url);
      channel = await connection.createChannel();
      channel.prefetch(5);

      const exchanges = [...new Set(BINDINGS.map((b) => b.exchange))];
      for (const ex of exchanges) {
        await channel.assertExchange(ex, "topic", { durable: true });
      }

      for (const binding of BINDINGS) {
        await channel.assertQueue(binding.queue, {
          durable: true,
          arguments: {
            "x-dead-letter-exchange": "dlx",
            "x-dead-letter-routing-key": `dead.${binding.queue}`,
          },
        });
        await channel.bindQueue(
          binding.queue,
          binding.exchange,
          binding.pattern,
        );
      }

      await channel.assertExchange("dlx", "topic", { durable: true });
      await channel.assertQueue("dead.letter.queue", { durable: true });

      for (const binding of BINDINGS) {
        channel.consume(binding.queue, async (msg) => {
          if (!msg) return;
          try {
            const payload = JSON.parse(msg.content.toString());
            logger.info(`Processing event: ${binding.pattern}`, { payload });

            const handler = handlers[binding.pattern];
            if (handler) {
              await handler(payload);
            } else {
              logger.warn(`No handler for event: ${binding.pattern}`);
            }

            channel.ack(msg);
          } catch (err) {
            logger.error(`Error processing ${binding.pattern}:`, err.message);

            const retryCount =
              (msg.properties.headers?.["x-retry-count"] || 0) + 1;
            if (retryCount < 3) {
              setTimeout(() => {
                channel.nack(msg, false, true);
              }, retryCount * 2000);
            } else {
              channel.nack(msg, false, false);
            }
          }
        });
      }

      logger.info("RabbitMQ consumer started — listening for events");

      connection.on("error", async (err) => {
        logger.error("RabbitMQ connection error:", err.message);
        setTimeout(startConsumer, 5000);
      });

      return;
    } catch (err) {
      logger.warn(
        `RabbitMQ consumer connect failed (${retries} retries left):`,
        err.message,
      );
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error("Failed to start RabbitMQ consumer");
};

module.exports = { startConsumer };
