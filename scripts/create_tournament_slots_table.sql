-- Create tournament slots table for bracket management
CREATE TABLE IF NOT EXISTS tournament_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  slot_position INTEGER NOT NULL,
  participant_name VARCHAR(255),
  admin_note TEXT,
  winner BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tournament_id, slot_position)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tournament_slots_tournament_id 
ON tournament_slots(tournament_id);

-- Add RLS policy for tournament slots
ALTER TABLE tournament_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournament slots" 
ON tournament_slots FOR SELECT 
USING (true);

CREATE POLICY "Admin can manage tournament slots" 
ON tournament_slots FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
