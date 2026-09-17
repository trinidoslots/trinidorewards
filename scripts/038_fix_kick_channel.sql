-- The Kick channel was stored under two different keys that drifted apart:
-- 035_add_kick_settings.sql seeds 'kick_channel_name', but every client that
-- actually starts chat polling reads 'kick_username' (giveaway-bot-client.tsx,
-- webhook-monitor.tsx). Nothing in the app ever writes 'kick_username', so the
-- value set by hand during testing ("roshtein") stuck and the pollers listened
-- to the wrong channel.
--
-- Point both keys at the real channel and keep them in step.
INSERT INTO settings (key, value)
VALUES
  ('kick_username', 'trinidoslots'),
  ('kick_channel_name', 'trinidoslots')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
