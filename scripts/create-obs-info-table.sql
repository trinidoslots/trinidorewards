-- Create obs_info table for OBS widget info items
CREATE TABLE IF NOT EXISTS obs_info (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable realtime for obs_info table
ALTER PUBLICATION supabase_realtime ADD TABLE obs_info;
