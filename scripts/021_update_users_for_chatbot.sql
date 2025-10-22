-- Add kick_id and last_rewarded columns to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS kick_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_rewarded TIMESTAMP DEFAULT NOW();

-- Create index on kick_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_kick_id ON users(kick_id);

-- Updated to use points_balance instead of points
-- Create function to increment points by kick_id
CREATE OR REPLACE FUNCTION increment_points(uid TEXT, val INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET points_balance = points_balance + val WHERE kick_id = uid;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment points by username
CREATE OR REPLACE FUNCTION increment_points_by_username(uname TEXT, val INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET points_balance = points_balance + val WHERE username = uname;
END;
$$ LANGUAGE plpgsql;
