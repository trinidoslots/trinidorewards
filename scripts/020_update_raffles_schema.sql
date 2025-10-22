-- Add entry_type column to raffles table
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'free' CHECK (entry_type IN ('free', 'points'));

-- Update existing raffles to set entry_type based on ticket_price
UPDATE raffles SET entry_type = CASE 
  WHEN ticket_price = 0 THEN 'free'
  ELSE 'points'
END
WHERE entry_type IS NULL;
