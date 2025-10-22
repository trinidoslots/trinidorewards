-- Create bonuses table for managing available bonuses
CREATE TABLE IF NOT EXISTS bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  code VARCHAR(100),
  terms TEXT,
  value VARCHAR(100),
  casino_name VARCHAR(255),
  casino_url TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for active bonuses
CREATE INDEX IF NOT EXISTS idx_bonuses_active ON bonuses(is_active);
CREATE INDEX IF NOT EXISTS idx_bonuses_featured ON bonuses(featured);
