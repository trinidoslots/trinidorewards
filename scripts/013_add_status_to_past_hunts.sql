-- Add status column to past_bonushunts table
ALTER TABLE past_bonushunts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

-- Update existing hunts to have 'Active' status
UPDATE past_bonushunts SET status = 'Active' WHERE status IS NULL;
