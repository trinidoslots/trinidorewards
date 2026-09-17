-- Add predictions_enabled setting
INSERT INTO settings (key, value)
VALUES ('predictions_enabled', 'false')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
