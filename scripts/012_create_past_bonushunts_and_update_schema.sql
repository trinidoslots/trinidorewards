-- Create past_bonushunts table and ensure opening_state exists
CREATE TABLE IF NOT EXISTS past_bonushunts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id text NOT NULL,
  hunt_name text,
  starting_balance numeric,
  opening_balance numeric,
  total_bonuses integer,
  total_bet_size numeric,
  total_result numeric,
  profit_loss numeric,
  bonuses jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Ensure opening_state table exists with proper structure
CREATE TABLE IF NOT EXISTS opening_state (
  id integer PRIMARY KEY DEFAULT 1,
  is_opening boolean DEFAULT false,
  current_bonus_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Insert default row if not exists
INSERT INTO opening_state (id, is_opening)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- Add hunt_id to bonus_hunts if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bonus_hunts' AND column_name='hunt_id') THEN
    ALTER TABLE bonus_hunts ADD COLUMN hunt_id text DEFAULT 'current';
  END IF;
END $$;
