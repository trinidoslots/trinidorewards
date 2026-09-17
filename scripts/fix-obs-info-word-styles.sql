-- Add word_styles column to store word-level formatting
ALTER TABLE obs_info
ADD COLUMN IF NOT EXISTS word_styles JSONB DEFAULT NULL;

-- Remove old columns if they exist
ALTER TABLE obs_info
DROP COLUMN IF EXISTS bold;

ALTER TABLE obs_info
DROP COLUMN IF EXISTS italic;

ALTER TABLE obs_info
DROP COLUMN IF EXISTS underline;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_obs_info_active ON obs_info(active);
