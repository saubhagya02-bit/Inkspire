const amqplib = require("amqplib");
const Notification = require("../models/Notification");
const { sendEmail } = require("../utils/mailer");
const logger = require("../utils/logger");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const QUEUE = "notification.worker.v2";

let channel;
let reconnecting = false;

// Handlers

async function handleUserRegistered(payload) {
  const { userId, email, username, verifyToken } = payload;
  const verifyUrl = `${FRONTEND_URL}/verify-email/${verifyToken}`;

  await Notification.create({
    userId,
    type: "welcome",
    title: `Welcome to InkSpire, ${username}!`,
    body: "Your account is ready. Start writing your first post!",
    actionUrl: "/dashboard",
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

  logger.info(`✓ Handled user.registered userId=${userId}`);
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

  logger.info(`✓ Handled password reset for ${email}`);
}

async function handlePostPublished(payload) {
  const { postId, title, authorId, slug } = payload;

  await Notification.create({
    userId: authorId,
    type: "post_published",
    title: "Your post is live! 🎉",
    body: `"${title}" has been published successfully.`,
    data: { postId, slug },
    actionUrl: `/posts/${slug}`,
    refId: postId,
    refType: "post",
    channels: { inApp: true },
  });

  logger.info(`✓ Handled post.published postId=${postId}`);
}

async function handlePostLiked(payload) {
  const { postId, postTitle, postSlug, authorId, likerId, likerUsername } =
    payload;

  // Don't notify if liker is the author
  if (authorId === likerId) return;

  await Notification.create({
    userId: authorId,
    type: "post_liked",
    title: `${likerUsername} liked your post`,
    body: `"${postTitle}"`,
    actorId: likerId,
    actorUsername: likerUsername,
    refId: postId,
    refType: "post",
    actionUrl: `/posts/${postSlug}`,
    channels: { inApp: true },
  });

  logger.info(`✓ Handled post.liked postId=${postId} by ${likerUsername}`);
}

async function handleCommentCreated(payload) {
  const { commentId, postId, postOwnerId, authorId, authorUsername, content } =
    payload;

  if (!postOwnerId || postOwnerId === authorId) return;

  await Notification.create({
    userId: postOwnerId,
    type: "comment_on_post",
    title: `${authorUsername} commented on your post`,
    body: content.length > 100 ? content.substring(0, 100) + "..." : content,
    actorId: authorId,
    actorUsername: authorUsername,
    refId: postId,
    refType: "post",
    actionUrl: `/posts/${postId}#comment-${commentId}`,
    channels: { inApp: true },
  });

  logger.info(`✓ Handled comment.created on post ${postId}`);
}

async function handleUserFollowed(payload) {
  const { followerId, followerUsername, followingId } = payload;

  await Notification.create({
    userId: followingId,
    type: "new_follower",
    title: `${followerUsername} started following you`,
    body: "You have a new follower!",
    actorId: followerId,
    actorUsername: followerUsername,
    actionUrl: `/profile/${followerId}`,
    channels: { inApp: true },
  });

  logger.info(`✓ Handled user.followed: ${followerUsername} → ${followingId}`);
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
    exchange: "user.events",
    pattern: "user.followed",
    handler: handleUserFollowed,
  },
  {
    exchange: "post.events",
    pattern: "post.published",
    handler: handlePostPublished,
  },
  { exchange: "post.events", pattern: "post.liked", handler: handlePostLiked },
  {
    exchange: "comment.events",
    pattern: "comment.created",
    handler: handleCommentCreated,
  },
];

// Worker
const startWorker = async () => {
  const url = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
  let retries = 10;

  while (retries-- > 0) {
    try {
      const conn = await amqplib.connect(url);
      channel = await conn.createChannel();
      channel.prefetch(10);

      for (const { exchange } of BINDINGS) {
        await channel.assertExchange(exchange, "topic", { durable: true });
      }

      await channel.assertQueue(QUEUE, {
        durable: true,
        arguments: { "x-dead-letter-exchange": "dlx.notifications" },
      });

      await channel.assertExchange("dlx.notifications", "topic", {
        durable: true,
      });
      await channel.assertQueue("dead.notifications", { durable: true });
      await channel.bindQueue("dead.notifications", "dlx.notifications", "#");

      for (const { exchange, pattern } of BINDINGS) {
        await channel.bindQueue(QUEUE, exchange, pattern);
        logger.info(`  Bound ${QUEUE} → ${exchange} [${pattern}]`);
      }

      channel.consume(
        QUEUE,
        async (msg) => {
          if (!msg) return;
          const routingKey = msg.fields.routingKey;
          try {
            const payload = JSON.parse(msg.content.toString());
            logger.info(`→ Processing: ${routingKey}`);

            const binding = BINDINGS.find((b) => b.pattern === routingKey);
            if (binding) {
              await binding.handler(payload);
            } else {
              logger.warn(`No handler for: ${routingKey}`);
            }
            channel.ack(msg);
          } catch (err) {
            logger.error(`Error processing ${routingKey}:`, err.message);
            const retryCount =
              (msg.properties.headers?.["x-retry-count"] || 0) + 1;
            if (retryCount < 3) {
              setTimeout(() => {
                try {
                  channel.nack(msg, false, true);
                } catch {}
              }, retryCount * 2000);
            } else {
              channel.nack(msg, false, false);
            }
          }
        },
        { noAck: false },
      );

      logger.info("✓ Notification worker started — listening for events");

      conn.on("error", (err) => {
        logger.error("RabbitMQ worker error:", err.message);
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
        `RabbitMQ worker connect failed, retrying... (${retries} left): ${err.message}`,
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
