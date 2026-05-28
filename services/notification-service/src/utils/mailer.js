const nodemailer = require("nodemailer");
const logger = require("./logger");
const templates = require("./emailTemplates");

// Transporter

let transporter;

const getTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.NODE_ENV === "production") {
    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS
    ) {
      throw new Error(
        "SMTP_HOST, SMTP_USER, and SMTP_PASS must be set in production",
      );
    }
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
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
      `Ethereal SMTP ready — preview emails at https://ethereal.email`,
    );
  }

  return transporter;
};

// Send email
/**
 * @param {object} opts
 * @param {string} opts.to          - recipient email address
 * @param {string} opts.subject     - email subject (used when no templateName)
 * @param {string} [opts.templateName] - key in emailTemplates.js
 * @param {object} [opts.templateData] - data passed to the template function
 * @param {string} [opts.html]      - raw HTML override (skips template)
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

    logger.info(`Email sent to ${to}: ${info.messageId}`);

    if (process.env.NODE_ENV !== "production") {
      logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return info;
  } catch (err) {
    logger.error(`Email send failed to ${to}:`, err.message);
    throw err;
  }
};

module.exports = { sendEmail };
