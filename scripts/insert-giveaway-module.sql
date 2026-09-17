-- Initialize giveaway modules
INSERT INTO modules (id, module_name, display_name, description, category, is_enabled, created_at, updated_at) 
VALUES 
  (gen_random_uuid(), 'giveaway', 'KickMCP Giveaway', 'Kick.com chat giveaway bot', 'main', true, NOW(), NOW())
ON CONFLICT (module_name) DO NOTHING;
