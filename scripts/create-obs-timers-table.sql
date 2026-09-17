-- Create obs_timers table for OBS widget countdown timers
CREATE TABLE IF NOT EXISTS obs_timers (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 300,
  active BOOLEAN NOT NULL DEFAULT true,
  bold_icon BOOLEAN DEFAULT true,
  bold_message BOOLEAN DEFAULT false,
  bold_time BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for obs_timers
ALTER TABLE obs_timers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to read active timers
CREATE POLICY "Allow public read access to active timers"
ON obs_timers
FOR SELECT
USING (true);

-- Create policy to allow updates to active timers
CREATE POLICY "Allow updates to timers"
ON obs_timers
FOR UPDATE
USING (true);

-- Create policy to allow insertions
CREATE POLICY "Allow insert timers"
ON obs_timers
FOR INSERT
WITH CHECK (true);

-- Create policy to allow deletions
CREATE POLICY "Allow delete timers"
ON obs_timers
FOR DELETE
USING (true);
