const Handlebars = require("handlebars");

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 600px; margin: 0 auto; background: #ffffff;
`;

const templates = {
  welcome: Handlebars.compile(`
    <div style="${BASE_STYLE}">
      <div style="background: #1a1a2e; padding: 40px; text-align: center;">
        <h1 style="color: #e94560; margin: 0;">InkSpire</h1>
      </div>
      <div style="padding: 40px;">
        <h2>Welcome, {{username}}! 👋</h2>
        <p>Thanks for joining InkSpire. Please verify your email address to get started.</p>
        <a href="{{verifyUrl}}" style="display:inline-block;background:#e94560;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;margin:20px 0;">
          Verify Email
        </a>
        <p style="color:#666;font-size:13px;">Link expires in 24 hours. If you didn't register, ignore this email.</p>
      </div>
    </div>
  `),

  passwordReset: Handlebars.compile(`
    <div style="${BASE_STYLE}">
      <div style="background: #1a1a2e; padding: 40px; text-align: center;">
        <h1 style="color: #e94560; margin: 0;">InkSpire</h1>
      </div>
      <div style="padding: 40px;">
        <h2>Password Reset Request 🔐</h2>
        <p>We received a request to reset your password. Click the button below:</p>
        <a href="{{resetUrl}}" style="display:inline-block;background:#e94560;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;margin:20px 0;">
          Reset Password
        </a>
        <p style="color:#666;font-size:13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    </div>
  `),

  newComment: Handlebars.compile(`
    <div style="${BASE_STYLE}">
      <div style="background: #1a1a2e; padding: 40px; text-align: center;">
        <h1 style="color: #e94560; margin: 0;">InkSpire</h1>
      </div>
      <div style="padding: 40px;">
        <h2>New Comment on Your Post 💬</h2>
        <p><strong>{{actorUsername}}</strong> commented on <em>{{postTitle}}</em>:</p>
        <blockquote style="border-left:4px solid #e94560;padding:12px 16px;background:#f9f9f9;margin:16px 0;border-radius:0 6px 6px 0;">
          {{commentContent}}
        </blockquote>
        <a href="{{postUrl}}" style="display:inline-block;background:#e94560;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          View Comment
        </a>
      </div>
    </div>
  `),

  postPublished: Handlebars.compile(`
    <div style="${BASE_STYLE}">
      <div style="background: #1a1a2e; padding: 40px; text-align: center;">
        <h1 style="color: #e94560; margin: 0;">InkSpire</h1>
      </div>
      <div style="padding: 40px;">
        <h2>New Post Published 📝</h2>
        <p><strong>{{authorName}}</strong> just published a new post:</p>
        <h3 style="color:#1a1a2e;">{{postTitle}}</h3>
        <p style="color:#555;">{{postExcerpt}}</p>
        <a href="{{postUrl}}" style="display:inline-block;background:#e94560;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          Read Post
        </a>
      </div>
    </div>
  `),
};

module.exports = templates;
