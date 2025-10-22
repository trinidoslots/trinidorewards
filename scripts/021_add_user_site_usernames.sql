-- Add table for storing user's usernames on different sites
CREATE TABLE IF NOT EXISTS user_site_usernames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_name TEXT NOT NULL,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, site_name)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_site_usernames_user_id ON user_site_usernames(user_id);

-- Add RLS policies
ALTER TABLE user_site_usernames ENABLE ROW LEVEL SECURITY;

-- Users can view and edit their own site usernames
CREATE POLICY "Users can view own site usernames" ON user_site_usernames
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own site usernames" ON user_site_usernames
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own site usernames" ON user_site_usernames
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own site usernames" ON user_site_usernames
  FOR DELETE USING (auth.uid() = user_id);
