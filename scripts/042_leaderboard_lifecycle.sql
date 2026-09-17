-- Leaderboard lifecycle: category, cadence, and the end-of-board record.
--
-- Until now a leaderboard was a title, a window and a pile of entries. There was
-- nothing to file it under, nothing that recorded it had ended, and nothing that
-- said whether the prizes had actually been paid — so "who won leaderboard X and
-- did they get their money" had no answer in the data.
--
-- Safe to run more than once.

ALTER TABLE leaderboards
  -- What the board measures, e.g. Earnings or Games. Free text: the admin
  -- offers the ones already in use rather than a fixed enum.
  ADD COLUMN IF NOT EXISTS category TEXT,
  -- How often it repeats: daily / weekly / monthly / custom.
  ADD COLUMN IF NOT EXISTS cadence TEXT DEFAULT 'custom',
  -- Where the standings come from.
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'csv',
  -- Set when the window closed and the ranks/prizes were frozen. Null means
  -- the board has not been finalised, even if end_date is in the past.
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE,
  -- Set when the prizes were actually paid out.
  ADD COLUMN IF NOT EXISTS credited BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS credited_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS credited_note TEXT;

-- The external account id behind a row, shown (shortened, copyable) in the
-- entries table. Usernames are not unique enough to pay someone by.
ALTER TABLE leaderboard_entries
  ADD COLUMN IF NOT EXISTS user_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_leaderboards_cadence ON leaderboards (cadence);
CREATE INDEX IF NOT EXISTS idx_leaderboards_credited ON leaderboards (credited);
CREATE INDEX IF NOT EXISTS idx_leaderboards_finalized ON leaderboards (finalized_at);

-- Boards whose window already closed are marked ended, but deliberately NOT
-- finalised: freezing ranks is the finaliser's job and it needs to run once,
-- with the payout preset, so the numbers are reproducible.
UPDATE leaderboards
   SET status = 'ended'
 WHERE end_date < NOW()
   AND status <> 'ended';

-- --- verify ------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM leaderboards)                                  AS total_leaderboards,
  (SELECT count(*) FROM leaderboard_entries)                           AS total_entries,
  (SELECT COALESCE(sum(prize_amount), 0) FROM leaderboard_entries)     AS total_entries_prize,
  (SELECT count(*) FROM leaderboards WHERE finalized_at IS NULL
     AND end_date < NOW())                                             AS awaiting_finalisation;
