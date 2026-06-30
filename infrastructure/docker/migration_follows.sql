-- Run this once on auth_db
-- docker exec -it blog-postgres psql -U inkspire -d auth_db -f /migration_follows.sql
-- OR run each statement manually via pgAdmin / psql

-- Follows table
CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- Add follower/following counts to users (denormalized for speed)
ALTER TABLE users ADD COLUMN IF NOT EXISTS follower_count  INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Make sure avatar_url column exists (should already, just in case)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;