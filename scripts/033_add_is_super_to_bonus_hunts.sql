-- Add is_super column to bonus_hunts table
ALTER TABLE bonus_hunts ADD COLUMN IF NOT EXISTS is_super BOOLEAN DEFAULT FALSE;
