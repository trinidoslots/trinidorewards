-- Add prize distribution type and API URL to leaderboards table
ALTER TABLE leaderboards 
ADD COLUMN IF NOT EXISTS prize_distribution_type VARCHAR(50) DEFAULT 'classic',
ADD COLUMN IF NOT EXISTS api_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS api_key VARCHAR(500);

-- Add comment to explain prize distribution types
COMMENT ON COLUMN leaderboards.prize_distribution_type IS 'Options: classic, balanced, wide';
