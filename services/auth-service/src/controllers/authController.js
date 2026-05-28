const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const { pool } = require("../utils/database");
const { setex } = require("../utils/redis");
const { publishEvent } = require("../utils/rabbitmq");
const logger = require("../utils/logger");

// Token helpers
const generateTokens = (user) => {
  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
  return { accessToken, refreshToken };
};

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// Register
const register = async (req, res) => {
  const { email, username, password, fullName } = req.body;
  try {
    const { rows: existing } = await pool.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [email, username],
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email or username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash, full_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, full_name, role`,
      [email, username, passwordHash, fullName],
    );
    const user = rows[0];

    const verifyToken = crypto.randomBytes(32).toString("hex");
    await pool.query(
      `INSERT INTO email_verifications (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
      [user.id, hashToken(verifyToken)],
    );

    await publishEvent("user.registered", {
      userId: user.id,
      email: user.email,
      username: user.username,
      verifyToken,
    });

    const { accessToken, refreshToken } = generateTokens(user);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.id, hashToken(refreshToken)],
    );

    res
      .status(201)
      .json({
        message: "Registration successful",
        user,
        accessToken,
        refreshToken,
      });
  } catch (err) {
    logger.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
};

// Login
const login = async (req, res) => {
  const { email, password, totpCode } = req.body;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND is_active = true",
      [email],
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const user = rows[0];

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: "Invalid credentials" });

    if (user.two_factor_enabled) {
      if (!totpCode) return res.json({ requiresTwoFactor: true });
      const valid2FA = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: "base32",
        token: totpCode,
        window: 2,
      });
      if (!valid2FA) return res.status(401).json({ error: "Invalid 2FA code" });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.id, hashToken(refreshToken)],
    );
    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [
      user.id,
    ]);
    await publishEvent("user.loggedIn", { userId: user.id, email: user.email });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) return res.status(400).json({ error: "Refresh token required" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const tokenHash = hashToken(token);
    const { rows } = await pool.query(
      `SELECT rt.*, u.role FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.is_revoked = false AND rt.expires_at > NOW()`,
      [tokenHash],
    );
    if (rows.length === 0)
      return res.status(401).json({ error: "Invalid refresh token" });

    await pool.query(
      "UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1",
      [tokenHash],
    );

    const user = { id: decoded.id, email: decoded.email, role: rows[0].role };
    const { accessToken, refreshToken: newRefresh } = generateTokens(user);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.id, hashToken(newRefresh)],
    );
    res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    logger.error("Refresh error:", err);
    res.status(401).json({ error: "Invalid refresh token" });
  }
};

// Logout
const logout = async (req, res) => {
  const { refreshToken: token } = req.body;
  const authHeader = req.headers["authorization"];
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  try {
    if (token) {
      await pool.query(
        "UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1",
        [hashToken(token)],
      );
    }
    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken);
        if (decoded?.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) await setex(`blacklist:${accessToken}`, ttl, "1");
        }
      } catch {
        logger.warn("Logout token decode failed");
      }
    }
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    logger.error("Logout error:", err);
    res.status(500).json({ error: "Logout failed" });
  }
};

// Verify email
const verifyEmail = async (req, res) => {
  const { token } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT ev.*, u.id as user_id
       FROM email_verifications ev
       JOIN users u ON u.id = ev.user_id
       WHERE ev.token = $1 AND ev.expires_at > NOW()`,
      [hashToken(token)],
    );
    if (rows.length === 0)
      return res.status(400).json({ error: "Invalid or expired token" });

    await pool.query("UPDATE users SET is_verified = true WHERE id = $1", [
      rows[0].user_id,
    ]);
    await pool.query("DELETE FROM email_verifications WHERE token = $1", [
      hashToken(token),
    ]);
    res.json({ message: "Email verified" });
  } catch (err) {
    logger.error("Verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    // Always return the same message to prevent email enumeration
    if (rows.length === 0) {
      return res.json({
        message: "If that email exists, a reset link has been sent.",
      });
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [rows[0].id, hashToken(resetToken)],
    );
    await publishEvent("user.passwordResetRequested", {
      userId: rows[0].id,
      email,
      resetToken,
    });
    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    logger.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to process request" });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM password_resets
       WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [hashToken(token)],
    );
    if (rows.length === 0)
      return res.status(400).json({ error: "Invalid or expired token" });

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      rows[0].user_id,
    ]);
    await pool.query(
      "UPDATE password_resets SET used_at = NOW() WHERE id = $1",
      [rows[0].id],
    );
    res.json({ message: "Password reset successful" });
  } catch (err) {
    logger.error("Reset password error:", err);
    res.status(500).json({ error: "Reset failed" });
  }
};

// 2FA

const setup2FA = async (req, res) => {
  const userId = req.user.id;
  try {
    const secret = speakeasy.generateSecret({ name: `BlogCMS:${userId}` });

    await pool.query(
      "UPDATE users SET two_factor_secret_pending = $1 WHERE id = $2",
      [secret.base32, userId],
    );
    const qr = await qrcode.toDataURL(secret.otpauth_url);
    res.json({ qrCode: qr });
  } catch (err) {
    logger.error("Setup 2FA error:", err);
    res.status(500).json({ error: "Failed to set up 2FA" });
  }
};

const enable2FA = async (req, res) => {
  const userId = req.user.id;
  const { code } = req.body;
  try {
    const { rows } = await pool.query(
      "SELECT two_factor_secret_pending FROM users WHERE id = $1",
      [userId],
    );
    if (!rows.length || !rows[0].two_factor_secret_pending) {
      return res
        .status(400)
        .json({ error: "2FA setup not initiated. Call /2fa/setup first." });
    }

    const valid = speakeasy.totp.verify({
      secret: rows[0].two_factor_secret_pending,
      encoding: "base32",
      token: code,
      window: 2,
    });
    if (!valid) return res.status(400).json({ error: "Invalid code" });

    await pool.query(
      `UPDATE users SET
         two_factor_secret = two_factor_secret_pending,
         two_factor_secret_pending = NULL,
         two_factor_enabled = true
       WHERE id = $1`,
      [userId],
    );
    res.json({ message: "2FA enabled successfully" });
  } catch (err) {
    logger.error("Enable 2FA error:", err);
    res.status(500).json({ error: "Failed to enable 2FA" });
  }
};

module.exports = {
  generateTokens,
  register,
  login,
  refreshToken,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  setup2FA,
  enable2FA,
};
