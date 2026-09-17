-- Add words column to store word-level formatting
ALTER TABLE obs_info
ADD COLUMN IF NOT EXISTS words JSONB DEFAULT '[]',
DROP COLUMN IF EXISTS bold,
DROP COLUMN IF EXISTS italic,
DROP COLUMN IF EXISTS underline;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_obs_info_active ON obs_info(active);
