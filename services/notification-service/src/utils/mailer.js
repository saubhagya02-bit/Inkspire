const nodemailer = require("nodemailer");
const logger = require("./logger");
const templates = require("./emailTemplates");

let transporter;

const getTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || "resend",
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify connection
    try {
      await transporter.verify();
      logger.info(`SMTP connected → ${process.env.SMTP_HOST}`);
    } catch (err) {
      logger.warn(
        `SMTP verify failed: ${err.message} — falling back to Ethereal`,
      );
      transporter = null;
      return getEtherealTransporter();
    }

    return transporter;
  }

  return getEtherealTransporter();
};

const getEtherealTransporter = async () => {
  const account = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  });
  logger.info(
    "Using Ethereal (fake SMTP) — set SMTP_HOST + SMTP_PASS in .env for real emails",
  );
  return transporter;
};

/**
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} [opts.templateName]
 * @param {object} [opts.templateData]
 * @param {string} [opts.html]
 */
const sendEmail = async ({ to, subject, templateName, templateData, html }) => {
  try {
    const t = await getTransporter();

    const emailHtml =
      html ||
      (templateName && templates[templateName]
        ? templates[templateName](templateData || {})
        : "<p>No content provided</p>");

    const info = await t.sendMail({
      from: `"InkSpire" <${process.env.EMAIL_FROM || "noreply@inkspire.com"}>`,
      to,
      subject: subject || "(no subject)",
      html: emailHtml,
    });

    logger.info(`Email sent to ${to} — messageId: ${info.messageId}`);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      logger.info(`Preview URL: ${previewUrl}`);
    }

    return info;
  } catch (err) {
    logger.error(`Email failed to ${to}: ${err.message}`);
    throw err;
  }
};

module.exports = { sendEmail };
