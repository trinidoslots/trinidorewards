-- Add last_active column to track user activity for chatbot
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT NOW();

-- Create index for faster active user queries
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);
