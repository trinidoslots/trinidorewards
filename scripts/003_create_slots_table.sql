-- Create slots table
CREATE TABLE IF NOT EXISTS slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read slots
CREATE POLICY "Anyone can view slots" ON slots FOR SELECT USING (true);

-- Only authenticated users can insert/update/delete slots
CREATE POLICY "Authenticated users can insert slots" ON slots FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update slots" ON slots FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete slots" ON slots FOR DELETE USING (auth.role() = 'authenticated');

-- Insert Play n Go games
INSERT INTO slots (game_name, provider) VALUES
('Book of Dead', 'Play n Go'),
('Reactoonz', 'Play n Go'),
('Moon Princess', 'Play n Go'),
('Rise of Olympus', 'Play n Go'),
('Fire Joker', 'Play n Go'),
('Tome of Madness', 'Play n Go'),
('Legacy of Dead', 'Play n Go'),
('Raging Rex', 'Play n Go'),
('Gemix', 'Play n Go'),
('Viking Runecraft', 'Play n Go');

-- Insert Pragmatic Play games
INSERT INTO slots (game_name, provider) VALUES
('Gates of Olympus', 'Pragmatic Play'),
('Sweet Bonanza', 'Pragmatic Play'),
('The Dog House', 'Pragmatic Play'),
('Sugar Rush', 'Pragmatic Play'),
('Starlight Princess', 'Pragmatic Play'),
('Wild West Gold', 'Pragmatic Play'),
('Great Rhino Megaways', 'Pragmatic Play'),
('Buffalo King Megaways', 'Pragmatic Play'),
('Fruit Party', 'Pragmatic Play'),
('Big Bass Bonanza', 'Pragmatic Play');

-- Insert Hacksaw Gaming games
INSERT INTO slots (game_name, provider) VALUES
('Wanted Dead or a Wild', 'Hacksaw Gaming'),
('Le Bandit', 'Hacksaw Gaming'),
('Chaos Crew', 'Hacksaw Gaming'),
('Stick Em', 'Hacksaw Gaming'),
('Warrior Graveyard', 'Hacksaw Gaming'),
('Bowery Boys', 'Hacksaw Gaming'),
('Cubes', 'Hacksaw Gaming'),
('Stack Em', 'Hacksaw Gaming'),
('RIP City', 'Hacksaw Gaming'),
('Hop N Pop', 'Hacksaw Gaming');

-- Insert Relax Gaming games
INSERT INTO slots (game_name, provider) VALUES
('Money Train 2', 'Relax Gaming'),
('Money Train 3', 'Relax Gaming'),
('Temple Tumble', 'Relax Gaming'),
('TNT Tumble', 'Relax Gaming'),
('Beast Mode', 'Relax Gaming'),
('Hellcatraz', 'Relax Gaming'),
('Money Cart 2', 'Relax Gaming'),
('Snake Arena', 'Relax Gaming'),
('Iron Bank', 'Relax Gaming'),
('Mega Flip', 'Relax Gaming');

-- Insert No Limit City games
INSERT INTO slots (game_name, provider) VALUES
('Mental', 'No Limit City'),
('San Quentin', 'No Limit City'),
('Deadwood', 'No Limit City'),
('East Coast vs West Coast', 'No Limit City'),
('Fire in the Hole', 'No Limit City'),
('Punk Rocker', 'No Limit City'),
('Tombstone', 'No Limit City'),
('Das xBoot', 'No Limit City'),
('Karen Maneater', 'No Limit City'),
('Serial', 'No Limit City');

-- Insert AvatarUX games
INSERT INTO slots (game_name, provider) VALUES
('CherryPop', 'AvatarUX'),
('PopRocks', 'AvatarUX'),
('BountyPop', 'AvatarUX'),
('TikiPop', 'AvatarUX'),
('LillyPop', 'AvatarUX'),
('HippoPop', 'AvatarUX'),
('PapayaPop', 'AvatarUX'),
('RagingPop', 'AvatarUX'),
('MonkeyPop', 'AvatarUX'),
('DoggyPop', 'AvatarUX');

-- Insert Backseat Gaming games
INSERT INTO slots (game_name, provider) VALUES
('Stacked', 'Backseat Gaming'),
('Hypernova', 'Backseat Gaming'),
('Megaways Jack', 'Backseat Gaming'),
('Reel Keeper', 'Backseat Gaming'),
('Reel Splitter', 'Backseat Gaming');

-- Insert Red Tiger games
INSERT INTO slots (game_name, provider) VALUES
('Gonzo''s Quest Megaways', 'Red Tiger'),
('Piggy Riches Megaways', 'Red Tiger'),
('Mystery Reels', 'Red Tiger'),
('Dragon''s Luck', 'Red Tiger'),
('Reel King Mega', 'Red Tiger'),
('Tiki Fruits', 'Red Tiger'),
('Wild Cats Multiline', 'Red Tiger'),
('Primate King', 'Red Tiger'),
('Treasure Mine', 'Red Tiger'),
('Wild Elements', 'Red Tiger');

-- Insert Gamomat games
INSERT INTO slots (game_name, provider) VALUES
('Books & Bulls', 'Gamomat'),
('Crystal Ball', 'Gamomat'),
('Ramses Book', 'Gamomat'),
('Fancy Fruits', 'Gamomat'),
('Wild Rubies', 'Gamomat'),
('Sticky Diamonds', 'Gamomat'),
('Book of Moorhuhn', 'Gamomat'),
('Golden Egg of Crazy Chicken', 'Gamomat'),
('Blazing Bull', 'Gamomat'),
('Fruits & Jokers', 'Gamomat');

-- Insert Massive Studios games
INSERT INTO slots (game_name, provider) VALUES
('Mega Masks', 'Massive Studios'),
('Wild Trigger', 'Massive Studios'),
('Aztec Spins', 'Massive Studios');

-- Insert Thunderkick games
INSERT INTO slots (game_name, provider) VALUES
('Esqueleto Explosivo', 'Thunderkick'),
('Pink Elephants', 'Thunderkick'),
('Beat the Beast: Quetzalcoatl''s Trial', 'Thunderkick'),
('Sword of Khans', 'Thunderkick'),
('Carnival Queen', 'Thunderkick'),
('Flame Busters', 'Thunderkick'),
('Roasty McFry', 'Thunderkick'),
('Divine Lotus', 'Thunderkick'),
('Midas Golden Touch', 'Thunderkick'),
('Crystal Quest: Arcane Tower', 'Thunderkick');

-- Insert Push Gaming games
INSERT INTO slots (game_name, provider) VALUES
('Jammin Jars', 'Push Gaming'),
('Razor Shark', 'Push Gaming'),
('Fat Rabbit', 'Push Gaming'),
('Jammin Jars 2', 'Push Gaming'),
('Razor Reveal', 'Push Gaming'),
('Wild Swarm', 'Push Gaming'),
('Retro Tapes', 'Push Gaming'),
('Big Bamboo', 'Push Gaming'),
('Mystery Mission', 'Push Gaming'),
('Mount Magmas', 'Push Gaming');
