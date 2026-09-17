-- Add data_url column to obs_info for emoji/icon URLs
ALTER TABLE obs_info ADD COLUMN IF NOT EXISTS data_url TEXT;
