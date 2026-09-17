-- Leaderboards: own timezone, and a payout preset from the shared catalogue.
--
-- Start and end are stored as timestamptz, which is correct — they are absolute
-- instants. What was missing is the zone the admin *meant* when typing them: a
-- naive "2026-10-01T00:00" from a datetime-local input was read as UTC, so a
-- board closing at midnight Berlin time closed two hours early. The zone is now
-- stored per leaderboard and the input is interpreted in it.
--
-- prize_distribution_type held one of three hard-coded shapes and only the admin
-- honoured it; the public page recomputed prizes from a different ladder. It is
-- superseded by payout_preset, which both sides resolve through
-- lib/leaderboard-payouts.ts.
--
-- Safe to run more than once.

ALTER TABLE leaderboards
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Berlin';

ALTER TABLE leaderboards
  ADD COLUMN IF NOT EXISTS payout_preset TEXT;

-- Carry the old three shapes over by name; anything else falls back to classic.
UPDATE leaderboards
   SET payout_preset = CASE
         WHEN prize_distribution_type IN ('classic', 'balanced', 'wide') THEN prize_distribution_type
         ELSE 'classic'
       END
 WHERE payout_preset IS NULL;

ALTER TABLE leaderboards
  ALTER COLUMN payout_preset SET DEFAULT 'classic';

COMMENT ON COLUMN leaderboards.timezone IS
  'IANA zone the start/end were entered in, e.g. Europe/Berlin. Display uses it too.';
COMMENT ON COLUMN leaderboards.payout_preset IS
  'Id from PAYOUT_PRESETS in lib/leaderboard-payouts.ts. Supersedes prize_distribution_type.';

-- --- verify ------------------------------------------------------------------
SELECT id, title, timezone, payout_preset, prize_distribution_type, start_date, end_date
  FROM leaderboards
 ORDER BY created_at DESC
 LIMIT 20;
