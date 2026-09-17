-- Add Kick configuration settings
INSERT INTO settings (key, value)
VALUES 
  ('kick_channel_name', 'TrinidoSlots'),
  ('kick_webhook_url', 'https://trinidorewards-bot.vercel.app/api/webhook'),
  ('obs_view_mode', 'opening')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
