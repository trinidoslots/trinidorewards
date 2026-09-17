-- Drop the unique constraint on day_number to allow multiple rewards per day
ALTER TABLE advent_calendar_rewards DROP CONSTRAINT IF EXISTS advent_calendar_rewards_day_number_key;

-- Add probability field (percentage chance of getting this reward)
ALTER TABLE advent_calendar_rewards ADD COLUMN IF NOT EXISTS probability DECIMAL(5,2) DEFAULT 100.00 CHECK (probability > 0 AND probability <= 100);

-- Add a display_order field for sorting rewards in admin
ALTER TABLE advent_calendar_rewards ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Update advent_calendar_claims to store the actual reward won
ALTER TABLE advent_calendar_claims ADD COLUMN IF NOT EXISTS reward_title TEXT;
ALTER TABLE advent_calendar_claims ADD COLUMN IF NOT EXISTS reward_description TEXT;
ALTER TABLE advent_calendar_claims ADD COLUMN IF NOT EXISTS reward_icon TEXT;
ALTER TABLE advent_calendar_claims ADD COLUMN IF NOT EXISTS reward_value TEXT;

-- Create index for day_number queries
CREATE INDEX IF NOT EXISTS idx_advent_rewards_day_number ON advent_calendar_rewards(day_number);

-- Update existing rewards to have 100% probability (they're the only reward for their day)
UPDATE advent_calendar_rewards SET probability = 100.00 WHERE probability IS NULL;
