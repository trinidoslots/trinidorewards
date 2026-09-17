-- Tournaments: participants play slots, payouts decide matches.
--
-- The bracket was slot-versus-slot (tournament_matches.slot1_name vs
-- slot2_name) with a winner_slot of 1 or 2. What is actually run is a bonus
-- battle: each participant buys into a slot for an amount, both sides open, and
-- the higher payout takes the match. That needs the participant on the match,
-- not just a game name.
--
-- The old slot columns stay so existing tournaments still render; new ones use
-- the participant columns.
--
-- Safe to run more than once.

-- --- participants -----------------------------------------------------------
ALTER TABLE tournament_participants
  ADD COLUMN IF NOT EXISTS buy_amount DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS casino TEXT,
  ADD COLUMN IF NOT EXISTS game_name TEXT,
  ADD COLUMN IF NOT EXISTS game_provider TEXT,
  ADD COLUMN IF NOT EXISTS game_image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_super BOOLEAN DEFAULT false,
  -- Position in the bracket, 1..size. Set when the tournament starts.
  ADD COLUMN IF NOT EXISTS seed INTEGER;

-- --- tournaments ------------------------------------------------------------
ALTER TABLE tournaments
  -- 4, 8, 16 or 32. max_participants already exists but is nullable and was
  -- never the bracket size; this is the one the bracket is built from.
  ADD COLUMN IF NOT EXISTS bracket_size INTEGER,
  -- registration -> running -> finished
  ADD COLUMN IF NOT EXISTS bracket_status TEXT DEFAULT 'registration',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS champion_participant_id UUID;

-- --- matches ----------------------------------------------------------------
ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS p1_id UUID REFERENCES tournament_participants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS p2_id UUID REFERENCES tournament_participants(id) ON DELETE SET NULL,
  -- What each side actually won. Null means the match has not been played.
  ADD COLUMN IF NOT EXISTS p1_payout DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS p2_payout DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS winner_participant_id UUID REFERENCES tournament_participants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS played_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_tournament_participants_seed
  ON tournament_participants (tournament_id, seed);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_round_order
  ON tournament_matches (tournament_id, round_number, match_number);

-- Backfill bracket_size from what is already there, so existing tournaments
-- have a sane value rather than null.
UPDATE tournaments
   SET bracket_size = COALESCE(max_participants, 8)
 WHERE bracket_size IS NULL;

-- --- verify ------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM tournaments)                                    AS tournaments,
  (SELECT count(*) FROM tournament_participants)                        AS participants,
  (SELECT count(*) FROM tournament_matches)                             AS matches,
  (SELECT count(*) FROM tournaments WHERE bracket_status = 'running')   AS running;
