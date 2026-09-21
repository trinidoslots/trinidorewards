-- Feeds do not all count in dollars.
--
-- EarnLab reports wagers in coins at a thousand to the dollar, so its 160524 is
-- $160.52. The board printed that number as it arrived and read $160,524.00 —
-- a silent factor of a thousand across every row, the prize column excepted,
-- because prizes come out of the pool rather than the feed.
--
-- Not every provider does this, so it is a per-provider setting rather than a
-- constant. 1 means the feed already reports currency.
--
-- The default is 1000 because that is what the boards using LEADERBOARD_API_URL
-- and LEADERBOARD_API_KEY need in order to be right, and those are the boards
-- that exist today.
--
-- Run 062 first. Safe to run more than once.

ALTER TABLE leaderboard_providers
  ADD COLUMN IF NOT EXISTS score_divisor NUMERIC NOT NULL DEFAULT 1000;

-- A zero would divide by zero and a negative one would invert the board. The
-- application falls back to 1 rather than trusting either, but the column
-- should not be able to hold them in the first place.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leaderboard_providers_score_divisor_check'
  ) THEN
    ALTER TABLE leaderboard_providers
      ADD CONSTRAINT leaderboard_providers_score_divisor_check CHECK (score_divisor > 0);
  END IF;
END $$;

COMMENT ON COLUMN leaderboard_providers.score_divisor IS
  'Divide the feed''s number by this to get currency. 1000 for a feed counting coins at a thousand to the dollar; 1 for one reporting currency already.';

-- --- verify ------------------------------------------------------------------
-- Every provider, with what its divisor does to a real EarnLab figure. A row
-- reading 160524.00 counts in currency and wants 1; one reading 160.52 counts
-- in coins and is set correctly.
SELECT
  name,
  score_divisor,
  round(160524 / score_divisor, 2) AS "160524_becomes"
FROM leaderboard_providers
ORDER BY name;

-- Both must come back 1.
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaderboard_providers'
      AND column_name = 'score_divisor')                                   AS column_added,
  (SELECT count(*) FROM pg_constraint
    WHERE conname = 'leaderboard_providers_score_divisor_check')           AS check_added;
