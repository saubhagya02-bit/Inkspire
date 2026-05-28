const nodemailer = require("nodemailer");
const Handlebars = require("handlebars");
const logger = require("./logger");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.sendgrid.net",
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "apikey",
    pass: process.env.SMTP_PASS,
  },
});

// Email Templates
const TEMPLATES = {
  welcome: {
    subject: "Welcome to InkSpire, {{username}}!",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#f9f9f9">
        <div style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
          <h1 style="color:#1a1a2e;margin:0 0 16px">Welcome, {{username}}! 🎉</h1>
          <p style="color:#555;line-height:1.6">Your account has been created successfully. Start writing and sharing your ideas with the world.</p>
          <a href="{{actionUrl}}" style="display:inline-block;background:#6c63ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;margin-top:20px;font-weight:600">
            Get Started
          </a>
          <p style="color:#999;font-size:12px;margin-top:32px">Please verify your email to unlock all features.</p>
        </div>
      </div>
    `,
  },

  email_verify: {
    subject: "Verify your email — InkSpire",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h2 style="color:#1a1a2e">Verify your email address</h2>
        <p style="color:#555">Click the button below to verify your email. This link expires in 24 hours.</p>
        <a href="{{actionUrl}}" style="display:inline-block;background:#6c63ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
          Verify Email
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">If you didn't create an account, you can ignore this email.</p>
      </div>
    `,
  },

  password_reset: {
    subject: "Reset your password — InkSpire",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h2 style="color:#1a1a2e">Reset your password</h2>
        <p style="color:#555">We received a request to reset your password. Click below (expires in 1 hour):</p>
        <a href="{{actionUrl}}" style="display:inline-block;background:#e74c3c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
          Reset Password
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">If you didn't request this, please ignore this email and your password will remain unchanged.</p>
      </div>
    `,
  },

  comment_on_post: {
    subject: "{{commenterName}} commented on your post",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h2 style="color:#1a1a2e">New comment on "{{postTitle}}"</h2>
        <div style="background:#f5f5f5;border-left:4px solid #6c63ff;padding:16px;border-radius:4px;margin:20px 0">
          <strong>{{commenterName}}</strong>
          <p style="margin:8px 0 0;color:#555">{{commentContent}}</p>
        </div>
        <a href="{{actionUrl}}" style="display:inline-block;background:#6c63ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none">
          View Comment
        </a>
      </div>
    `,
  },

  post_published: {
    subject: "New post: {{postTitle}}",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <h2 style="color:#1a1a2e">{{authorName}} published a new post</h2>
        <h3 style="color:#6c63ff">{{postTitle}}</h3>
        <p style="color:#555">{{postExcerpt}}</p>
        <a href="{{actionUrl}}" style="display:inline-block;background:#6c63ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none">
          Read Post
        </a>
      </div>
    `,
  },
};

const renderTemplate = (templateKey, data) => {
  const template = TEMPLATES[templateKey];
  if (!template) throw new Error(`Email template '${templateKey}' not found`);
  return {
    subject: Handlebars.compile(template.subject)(data),
    html: Handlebars.compile(template.html)(data),
  };
};

const sendEmail = async ({ to, templateKey, data }) => {
  try {
    const { subject, html } = renderTemplate(templateKey, data);
    const info = await transporter.sendMail({
      from: `InkSpire <${process.env.EMAIL_FROM || "noreply@inkspire.com"}>`,
      to,
      subject,
      html,
    });
    logger.info(`Email sent: ${info.messageId} → ${to}`);
    return info;
  } catch (err) {
    logger.error("Email send failed:", { to, templateKey, error: err.message });
    throw err;
  }
};

// For development — log emails instead of sending
if (process.env.NODE_ENV === "development") {
  transporter.verify((err) => {
    if (err) logger.warn("SMTP not configured — emails will be logged only");
  });
}

module.exports = { sendEmail, renderTemplate };
