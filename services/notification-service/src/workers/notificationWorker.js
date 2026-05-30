const amqplib = require("amqplib");
const axios = require("axios");
const Notification = require("../models/Notification");
const { sendEmail } = require("../utils/mailer");
const logger = require("../utils/logger");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const POST_SERVICE = process.env.POST_SERVICE_URL || "http://post-service:3002";
const QUEUE = "notification.worker.v2";

let channel;
let reconnecting = false;

// Helpers
async function getPostOwner(postId) {
  try {
    const res = await axios.get(`${POST_SERVICE}/posts/${postId}`, {
      timeout: 5000,
    });
    return res.data?.author_id || null;
  } catch (err) {
    logger.warn(`Could not look up post owner for ${postId}: ${err.message}`);
    return null;
  }
}

// Event Handlers
async function handleUserRegistered(payload) {
  const { userId, email, username, verifyToken } = payload;
  if (!userId || !email) {
    logger.warn("user.registered payload missing userId or email");
    return;
  }
  const verifyUrl = `${FRONTEND_URL}/verify-email/${verifyToken}`;

  await Notification.create({
    userId,
    type: "welcome",
    title: `Welcome to InkSpire, ${username}!`,
    body: "Your account is ready. Start writing your first post!",
    actionUrl: "/",
    channels: { inApp: true, email: false },
  });

  // email verify reminder
  await Notification.create({
    userId,
    type: "email_verify",
    title: "Please verify your email",
    body: "Check your inbox and click the verification link.",
    actionUrl: verifyUrl,
    channels: { inApp: true, email: true },
  });

  // Send email
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
  if (!email || !resetToken) {
    logger.warn("user.passwordResetRequested missing email or resetToken");
    return;
  }
  const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}`;

  await sendEmail({
    to: email,
    subject: "Reset your InkSpire password",
    templateName: "passwordReset",
    templateData: { resetUrl },
  }).catch((err) => logger.error("Password reset email failed:", err.message));

  logger.info(`✓ Handled passwordReset for ${email}`);
}

async function handlePostPublished(payload) {
  const { postId, title, authorId, slug } = payload;
  if (!authorId || !postId) {
    logger.warn("post.published missing authorId or postId");
    return;
  }
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

  logger.info(`✓ Handled post.published postId=${postId}`);
}

async function handleCommentCreated(payload) {
  const { commentId, postId, authorId, authorUsername, content } = payload;
  if (!postId || !authorId) {
    logger.warn("comment.created missing postId or authorId");
    return;
  }

  let postOwnerId = payload.postOwnerId || null;
  if (!postOwnerId) {
    postOwnerId = await getPostOwner(postId);
  }

  if (!postOwnerId) {
    logger.warn(
      `comment.created: could not determine post owner for post ${postId}`,
    );
    return;
  }

  if (postOwnerId === authorId) {
    logger.info(
      `comment.created: commenter is post owner, skipping notification`,
    );
    return;
  }

  const truncated =
    content.length > 120 ? content.substring(0, 120) + "…" : content;

  await Notification.create({
    userId: postOwnerId,
    type: "comment_on_post",
    title: `${authorUsername} commented on your post`,
    body: truncated,
    actorId: authorId,
    actorUsername: authorUsername,
    refId: postId,
    refType: "post",
    actionUrl: `/posts/${postId}#comment-${commentId}`,
    channels: { inApp: true },
  });

  logger.info(`✓ Handled comment.created → notified postOwner=${postOwnerId}`);
}

async function handleCommentCountIncrement(payload) {
  const { postId } = payload;
  if (!postId) return;
  try {
    await axios.patch(
      `${POST_SERVICE}/posts/${postId}/comment-count`,
      { delta: 1 },
      { timeout: 5000 },
    );
    logger.info(`✓ comment_count +1 for post ${postId}`);
  } catch (err) {
    logger.warn(`comment_count increment failed for ${postId}: ${err.message}`);
  }
}

async function handleCommentCountDecrement(payload) {
  const { postId } = payload;
  if (!postId) return;
  try {
    await axios.patch(
      `${POST_SERVICE}/posts/${postId}/comment-count`,
      { delta: -1 },
      { timeout: 5000 },
    );
    logger.info(`✓ comment_count -1 for post ${postId}`);
  } catch (err) {
    logger.warn(`comment_count decrement failed for ${postId}: ${err.message}`);
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

// Worker
const startWorker = async () => {
  const url = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
  let retries = 10;

  while (retries-- > 0) {
    try {
      const conn = await amqplib.connect(url);
      channel = await conn.createChannel();
      channel.prefetch(10);

      const exchanges = [...new Set(BINDINGS.map((b) => b.exchange))];
      for (const ex of exchanges) {
        await channel.assertExchange(ex, "topic", { durable: true });
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
        logger.info(`  Bound ${QUEUE} ← ${exchange} [${pattern}]`);
      }

      // Consume
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
            logger.error(`✗ Failed [${routingKey}]: ${err.message}`);

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
              channel.nack(msg, false, false);
            }
          }
        },
        { noAck: false },
      );

      logger.info("✓ Notification worker started — listening for events");

      conn.on("error", (err) => {
        logger.error("RabbitMQ connection error:", err.message);
        channel = null;
        scheduleReconnect();
      });
      conn.on("close", () => {
        logger.warn("RabbitMQ connection closed — will reconnect");
        channel = null;
        scheduleReconnect();
      });

      reconnecting = false;
      return;
    } catch (err) {
      logger.warn(
        `RabbitMQ connect failed (${retries} retries left): ${err.message}`,
      );
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  throw new Error("Notification worker failed to connect after 10 retries");
};

const scheduleReconnect = () => {
  if (reconnecting) return;
  reconnecting = true;
  setTimeout(async () => {
    try {
      await startWorker();
    } catch (err) {
      logger.error("Reconnect failed:", err.message);
      reconnecting = false;
      scheduleReconnect();
    }
  }, 5000);
};

module.exports = { startWorker };
