-- Add user_id column to raffle_entries if it doesn't exist
ALTER TABLE raffle_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Make ticket_numbers and points_spent nullable since they're not always used
ALTER TABLE raffle_entries ALTER COLUMN ticket_numbers DROP NOT NULL;
ALTER TABLE raffle_entries ALTER COLUMN points_spent DROP NOT NULL;

-- Add default empty array for ticket_numbers
ALTER TABLE raffle_entries ALTER COLUMN ticket_numbers SET DEFAULT '{}';

-- Add default 0 for points_spent
ALTER TABLE raffle_entries ALTER COLUMN points_spent SET DEFAULT 0;

-- Update RLS policies to allow service role operations
-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to insert raffles" ON raffles;
DROP POLICY IF EXISTS "Allow authenticated users to update raffles" ON raffles;
DROP POLICY IF EXISTS "Allow authenticated users to delete raffles" ON raffles;
DROP POLICY IF EXISTS "Allow authenticated users to insert raffle entries" ON raffle_entries;

-- Create new policies that allow service role (for API routes)
CREATE POLICY "Allow service role to manage raffles" ON raffles
  FOR ALL USING (true);

CREATE POLICY "Allow service role to manage raffle entries" ON raffle_entries
  FOR ALL USING (true);

-- Create index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_raffle_entries_user_id ON raffle_entries(user_id);
