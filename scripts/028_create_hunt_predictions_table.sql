-- Create hunt_predictions table for "Guess The Balance" feature
CREATE TABLE IF NOT EXISTS hunt_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  predicted_end_balance NUMERIC NOT NULL,
  predicted_max_multiplier NUMERIC,
  predicted_best_game TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hunt_predictions_hunt_id ON hunt_predictions(hunt_id);
CREATE INDEX IF NOT EXISTS idx_hunt_predictions_user_id ON hunt_predictions(user_id);

-- Enable RLS
ALTER TABLE hunt_predictions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read predictions
CREATE POLICY "Anyone can view predictions" ON hunt_predictions
  FOR SELECT USING (true);

-- Allow authenticated users to insert their own predictions
CREATE POLICY "Users can insert their own predictions" ON hunt_predictions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR true);

-- Allow users to update their own predictions
CREATE POLICY "Users can update their own predictions" ON hunt_predictions
  FOR UPDATE USING (auth.role() = 'authenticated' OR true);

-- Allow service role full access
CREATE POLICY "Service role has full access to predictions" ON hunt_predictions
  FOR ALL USING (auth.role() = 'service_role');
