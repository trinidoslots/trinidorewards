-- Create modules table for feature management
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default modules
INSERT INTO modules (module_name, display_name, description, category, is_enabled) VALUES
('claim_bonuses', 'Claim Bonuses', 'Allow users to claim bonus rewards', 'main', true),
('active_bonuses', 'Active Bonuses', 'Display currently active bonuses', 'main', true),
('advent_calendar', 'Advent Calendar', 'Holiday advent calendar feature', 'main', true),
('stream_store', 'Stream Store', 'In-stream shop and purchases', 'main', true),
('bonus_hunt', 'Bonus Hunt', 'Main bonus hunt feature', 'bonus_hunt', true),
('hunt_current', 'Current Hunt', 'Display current hunt progress', 'bonus_hunt', true),
('hunt_predictions', 'Hunt Predictions', 'Allow users to predict hunt outcomes', 'bonus_hunt', true),
('hunt_history', 'Hunt History', 'Display past hunt records', 'bonus_hunt', true),
('raffles', 'Raffles', 'Raffle draw system', 'main', true),
('schedule', 'Schedule', 'Stream schedule display', 'main', true),
('tournament', 'Tournament', 'Tournament management', 'main', true),
('leaderboard', 'Leaderboard', 'User leaderboard rankings', 'main', true)
ON CONFLICT (module_name) DO NOTHING;
