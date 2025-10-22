-- Add one_purchase_per_user column to store_items table
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS one_purchase_per_user BOOLEAN DEFAULT false;

-- Add settings table for total given away
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default total given away value
INSERT INTO settings (key, value)
VALUES ('total_given_away', '432565')
ON CONFLICT (key) DO NOTHING;
