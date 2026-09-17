-- Add data_url column to obs_timers table
ALTER TABLE obs_timers ADD COLUMN IF NOT EXISTS data_url TEXT;
