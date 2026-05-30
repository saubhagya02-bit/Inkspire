const { Pool } = require("pg");
const logger = require("./logger");

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "postgres",
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || "inkspire",
  password: process.env.POSTGRES_PASSWORD || "inkspire_password",
  database: "post_db",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const connectDB = async () => {
  const client = await pool.connect();
  logger.info("PostgreSQL connected (post_db)");

  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS categories (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100) UNIQUE NOT NULL,
        slug        VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tags (
        id   SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL
      );

      -- FIX: added author_username column so getPosts can show who wrote the post
      -- without a cross-DB join we store a denormalized copy updated on write
      CREATE TABLE IF NOT EXISTS posts (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title           VARCHAR(500) NOT NULL,
        slug            VARCHAR(600) UNIQUE NOT NULL,
        excerpt         TEXT,
        content         TEXT NOT NULL,
        content_html    TEXT,
        cover_image_url TEXT,
        author_id       UUID NOT NULL,
        author_username VARCHAR(100),
        category_id     INTEGER REFERENCES categories(id),
        status          VARCHAR(20) DEFAULT 'draft'
                          CHECK (status IN ('draft','published','archived','scheduled')),
        visibility      VARCHAR(20) DEFAULT 'public'
                          CHECK (visibility IN ('public','private','members')),
        scheduled_at    TIMESTAMPTZ,
        published_at    TIMESTAMPTZ,
        view_count      INTEGER DEFAULT 0,
        like_count      INTEGER DEFAULT 0,
        comment_count   INTEGER DEFAULT 0,
        reading_time    INTEGER DEFAULT 0,
        seo_title       VARCHAR(255),
        seo_description TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS post_tags (
        post_id UUID    REFERENCES posts(id) ON DELETE CASCADE,
        tag_id  INTEGER REFERENCES tags(id)  ON DELETE CASCADE,
        PRIMARY KEY (post_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS post_likes (
        user_id    UUID NOT NULL,
        post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, post_id)
      );

      CREATE TABLE IF NOT EXISTS post_revisions (
        id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        title     VARCHAR(500),
        content   TEXT,
        author_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_posts_author     ON posts(author_id);
      CREATE INDEX IF NOT EXISTS idx_posts_status     ON posts(status);
      CREATE INDEX IF NOT EXISTS idx_posts_slug       ON posts(slug);
      CREATE INDEX IF NOT EXISTS idx_posts_published  ON posts(published_at DESC)
                                                       WHERE status = 'published';
      CREATE INDEX IF NOT EXISTS idx_posts_category   ON posts(category_id);
      CREATE INDEX IF NOT EXISTS idx_post_likes_user  ON post_likes(user_id);
    `);

    // Seed default categories
    await client.query(`
      INSERT INTO categories (name, slug, description) VALUES
        ('Technology', 'technology', 'Tech articles and tutorials'),
        ('Design',     'design',     'UI/UX and creative design'),
        ('Business',   'business',   'Business and startups'),
        ('Lifestyle',  'lifestyle',  'Life and personal growth')
      ON CONFLICT (slug) DO NOTHING;
    `);

    logger.info("Post DB schema initialized");
  } finally {
    client.release();
  }
};

module.exports = { pool, connectDB };
