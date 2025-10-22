-- Delete all existing slots
DELETE FROM slots;

-- Insert slots from CSV
-- This is a placeholder - run the parse_csv.py script to generate the actual INSERT statements
-- The script will fetch the CSV and generate proper INSERT statements

-- For now, adding a few sample entries to show the structure
INSERT INTO slots (game_name, provider) VALUES
('Sample Slot 1', 'Play''n GO'),
('Sample Slot 2', 'Pragmatic Play')
ON CONFLICT (game_name, provider) DO NOTHING;

-- NOTE: After running parse_csv.py, replace this file with the generated SQL
