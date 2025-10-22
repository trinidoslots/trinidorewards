-- Add image_url column to leaderboards table
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment
COMMENT ON COLUMN leaderboards.image_url IS 'URL to header image for the leaderboard';
