-- Drop the existing unique index if it exists
DROP INDEX IF EXISTS slots_game_name_provider_unique;
DROP INDEX IF EXISTS slots_game_name_provider_idx;

-- Drop and recreate the slots table
DROP TABLE IF EXISTS slots CASCADE;

CREATE TABLE slots (
  id BIGSERIAL PRIMARY KEY,
  game_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a unique index with a different name
CREATE UNIQUE INDEX slots_unique_game_provider ON slots(game_name, provider);

-- Enable Row Level Security
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view slots"
  ON slots FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage slots"
  ON slots FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
