const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;

const { pool } = require("./database");
const logger = require("./logger");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/oauth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(new Error("Google account has no email"), null);
        }

        const { rows } = await pool.query(
          `SELECT * FROM users 
           WHERE (oauth_provider = $1 AND oauth_id = $2) 
           OR email = $3`,
          ["google", profile.id, email],
        );

        if (rows.length > 0) {
          logger.info(`Google OAuth login: ${email}`);
          return done(null, rows[0]);
        }

        const username = `google_${profile.id}`;

        const { rows: newUser } = await pool.query(
          `INSERT INTO users 
           (email, username, full_name, avatar_url, oauth_provider, oauth_id, is_verified)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           RETURNING *`,
          [
            email,
            username,
            profile.displayName || "",
            profile.photos?.[0]?.value || null,
            "google",
            profile.id,
          ],
        );

        logger.info(`Google OAuth new user created: ${email}`);
        return done(null, newUser[0]);
      } catch (err) {
        logger.error("Google OAuth error:", err);
        return done(err, null);
      }
    },
  ),
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "/auth/oauth/github/callback",
      scope: ["user:email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails?.[0]?.value || `${profile.username}@github.local`;

        const { rows } = await pool.query(
          `SELECT * FROM users 
           WHERE (oauth_provider = $1 AND oauth_id = $2) 
           OR email = $3`,
          ["github", profile.id, email],
        );

        if (rows.length > 0) {
          logger.info(`GitHub OAuth login: ${email}`);
          return done(null, rows[0]);
        }

        const username = `github_${profile.id}`;

        const { rows: newUser } = await pool.query(
          `INSERT INTO users 
           (email, username, full_name, avatar_url, oauth_provider, oauth_id, is_verified)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           RETURNING *`,
          [
            email,
            username,
            profile.displayName || profile.username,
            profile.photos?.[0]?.value || null,
            "github",
            profile.id,
          ],
        );

        logger.info(`GitHub OAuth new user created: ${email}`);
        return done(null, newUser[0]);
      } catch (err) {
        logger.error("GitHub OAuth error:", err);
        return done(err, null);
      }
    },
  ),
);

module.exports = passport;
