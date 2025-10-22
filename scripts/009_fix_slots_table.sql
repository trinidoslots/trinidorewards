-- Drop the existing slots table and recreate it properly
DROP TABLE IF EXISTS slots CASCADE;

-- Recreate the slots table with provider column
CREATE TABLE slots (
  id BIGSERIAL PRIMARY KEY,
  game_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a unique index on game_name and provider combination
CREATE UNIQUE INDEX IF NOT EXISTS slots_game_name_provider_idx ON slots(game_name, provider);

-- Enable Row Level Security
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view slots" ON slots;
DROP POLICY IF EXISTS "Authenticated users can insert slots" ON slots;

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
