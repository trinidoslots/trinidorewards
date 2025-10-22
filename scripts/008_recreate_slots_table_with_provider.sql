-- Drop the existing slots table completely to start fresh
DROP TABLE IF EXISTS slots CASCADE;

-- Recreate the slots table with provider column
CREATE TABLE slots (
  id BIGSERIAL PRIMARY KEY,
  game_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_name, provider)
);

-- Enable Row Level Security
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read slots
CREATE POLICY "Anyone can view slots"
  ON slots FOR SELECT
  TO public
  USING (true);

-- Create policy to allow authenticated users to insert slots
CREATE POLICY "Authenticated users can insert slots"
  ON slots FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add provider column to bonus_hunts table if it doesn't exist
ALTER TABLE bonus_hunts ADD COLUMN IF NOT EXISTS provider TEXT;

-- Add opening_balance column to bonus_hunts table if it doesn't exist
ALTER TABLE bonus_hunts ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;
