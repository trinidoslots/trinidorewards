-- Add provider column to bonus_hunts table
ALTER TABLE bonus_hunts ADD COLUMN IF NOT EXISTS provider TEXT;

-- Add opening_balance to hunt_statistics (or bonus_hunts if that's where it's stored)
ALTER TABLE bonus_hunts ADD COLUMN IF NOT EXISTS opening_balance NUMERIC;

-- Update slots table to ensure it has the correct structure
-- First, drop the existing unique constraint if it exists
ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_game_name_provider_key;

-- Add a new unique constraint on game_name and provider
ALTER TABLE slots ADD CONSTRAINT slots_game_name_provider_unique UNIQUE (game_name, provider);
