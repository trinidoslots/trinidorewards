-- What we know about each slot, so the bar does not depend on a scrape working.
--
-- The extension reads the game's title reliably, but the max-win multiplier and
-- the "Only on Stake" badge come out of the page's visible text and do not
-- always survive a layout change or a slow render. Remembering them per game
-- turns that from "the bar is missing half its fields" into "the bar is missing
-- them once, the first time you ever open that game".
--
-- Keyed on a normalised name rather than the raw title, so "Loan Shark",
-- "loan shark" and " Loan  Shark " are one row.

CREATE TABLE IF NOT EXISTS slot_meta (
  name_key    TEXT PRIMARY KEY,

  -- The title as last seen, for display in the admin list.
  slot_name   TEXT NOT NULL,
  provider    TEXT,
  max_win     TEXT,
  badge       TEXT,
  image_url   TEXT,

  -- A best win typed in by hand. NULL means "work it out from the hunts",
  -- which is the normal case; setting it pins the figure.
  best_win    NUMERIC(14,2),

  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The bar shows the figure, so now_playing carries the resolved value rather
-- than making the overlay join anything.
ALTER TABLE now_playing ADD COLUMN IF NOT EXISTS best_win NUMERIC(14,2);

-- Looking up a game's best result from the hunts is the common query.
CREATE INDEX IF NOT EXISTS hunt_bonuses_game_name_lower_idx
  ON hunt_bonuses (lower(trim(game_name)));

-- RLS: readable by anyone, writable by nobody through the API — the same shape
-- as now_playing. The overlay never reads this table (the resolved values are
-- already on now_playing), but the admin list does, and both write routes hold
-- the service role.
ALTER TABLE slot_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slot_meta readable by everyone" ON slot_meta;
CREATE POLICY "slot_meta readable by everyone"
  ON slot_meta FOR SELECT USING (true);

-- Seed from what the hunts already know. Every game ever added to a hunt gets a
-- row with its provider and artwork, so the first time you open a game you have
-- played before, the bar is already complete.
INSERT INTO slot_meta (name_key, slot_name, provider, image_url, updated_at)
SELECT DISTINCT ON (lower(trim(game_name)))
       lower(trim(game_name)),
       trim(game_name),
       NULLIF(trim(coalesce(provider, '')), ''),
       NULLIF(trim(coalesce(image_url, '')), ''),
       now()
  FROM hunt_bonuses
 WHERE coalesce(trim(game_name), '') <> ''
 ORDER BY lower(trim(game_name)), created_at DESC
ON CONFLICT (name_key) DO NOTHING;

-- Verify.
SELECT
  (SELECT count(*) FROM slot_meta)                                        AS slots_known,
  (SELECT count(*) FROM slot_meta WHERE provider IS NOT NULL)             AS with_provider,
  (SELECT count(*) FROM slot_meta WHERE image_url IS NOT NULL)            AS with_artwork,
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'slot_meta')        AS rls_on,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name = 'now_playing' AND column_name = 'best_win')  AS best_win_column;
