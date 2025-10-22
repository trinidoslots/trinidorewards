-- Create raffles table
CREATE TABLE IF NOT EXISTS raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  prize_name TEXT NOT NULL,
  prize_value DECIMAL(10, 2),
  prize_image_url TEXT,
  ticket_price INTEGER NOT NULL DEFAULT 100, -- Points cost per ticket
  max_tickets INTEGER, -- Max tickets per user (null = unlimited)
  total_tickets_available INTEGER, -- Total tickets available (null = unlimited)
  tickets_sold INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  draw_date TIMESTAMPTZ,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended', 'drawn')),
  winner_username TEXT,
  winner_ticket_number INTEGER,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create raffle_entries table
CREATE TABLE IF NOT EXISTS raffle_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  ticket_numbers INTEGER[] NOT NULL,
  tickets_purchased INTEGER NOT NULL,
  points_spent INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_raffles_status ON raffles(status);
CREATE INDEX IF NOT EXISTS idx_raffles_featured ON raffles(featured);
CREATE INDEX IF NOT EXISTS idx_raffles_end_date ON raffles(end_date);
CREATE INDEX IF NOT EXISTS idx_raffle_entries_raffle_id ON raffle_entries(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_entries_username ON raffle_entries(username);

-- Enable RLS
ALTER TABLE raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE raffle_entries ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to raffles" ON raffles
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to raffle entries" ON raffle_entries
  FOR SELECT USING (true);

-- Added admin policies for raffles table management
-- Create policies for authenticated users to manage raffles (admin operations)
CREATE POLICY "Allow authenticated users to insert raffles" ON raffles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update raffles" ON raffles
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete raffles" ON raffles
  FOR DELETE USING (auth.role() = 'authenticated');

-- Create policies for authenticated insert (for buying tickets)
CREATE POLICY "Allow authenticated users to insert raffle entries" ON raffle_entries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
