-- Create prediction_settings table
CREATE TABLE IF NOT EXISTS prediction_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  predictions_enabled BOOLEAN DEFAULT false,
  predictions_start_time TIMESTAMP WITH TIME ZONE,
  predictions_end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE prediction_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for prediction_settings
-- Allow anyone to read settings
CREATE POLICY "Allow public read access to prediction settings" 
ON prediction_settings 
FOR SELECT 
USING (true);

-- Allow service role to manage settings
CREATE POLICY "Service role has full access to prediction settings" 
ON prediction_settings 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
