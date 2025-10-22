-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  prize_pool DECIMAL(10, 2) NOT NULL DEFAULT 0,
  entry_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,
  tournament_type VARCHAR(50) NOT NULL DEFAULT 'bracket', -- bracket, points, leaderboard
  game_type VARCHAR(100), -- e.g., "Slots", "Blackjack", "Roulette"
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming', -- upcoming, registration, active, completed
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  registration_deadline TIMESTAMP WITH TIME ZONE,
  rules TEXT,
  featured BOOLEAN DEFAULT false,
  winner_username VARCHAR(255),
  winner_prize DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tournament participants table
CREATE TABLE IF NOT EXISTS tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  username VARCHAR(255) NOT NULL,
  score DECIMAL(10, 2) DEFAULT 0,
  rank INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, username)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_date ON tournaments(start_date);
CREATE INDEX IF NOT EXISTS idx_tournaments_featured ON tournaments(featured);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament_id ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_score ON tournament_participants(score DESC);

-- Enable RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tournaments
CREATE POLICY "Public can view tournaments" ON tournaments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert tournaments" ON tournaments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update tournaments" ON tournaments
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete tournaments" ON tournaments
  FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for tournament_participants
CREATE POLICY "Public can view tournament participants" ON tournament_participants
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert participants" ON tournament_participants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update participants" ON tournament_participants
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete participants" ON tournament_participants
  FOR DELETE USING (auth.role() = 'authenticated');

-- Function to update tournament status automatically
CREATE OR REPLACE FUNCTION update_tournament_status()
RETURNS void AS $$
BEGIN
  -- Update to registration if registration is open
  UPDATE tournaments
  SET status = 'registration'
  WHERE status = 'upcoming'
    AND registration_deadline IS NOT NULL
    AND NOW() >= (start_date - INTERVAL '7 days')
    AND NOW() < registration_deadline;

  -- Update to active when start date is reached
  UPDATE tournaments
  SET status = 'active'
  WHERE status IN ('upcoming', 'registration')
    AND NOW() >= start_date
    AND NOW() < end_date;

  -- Update to completed when end date is reached
  UPDATE tournaments
  SET status = 'completed'
  WHERE status = 'active'
    AND NOW() >= end_date;
END;
$$ LANGUAGE plpgsql;
