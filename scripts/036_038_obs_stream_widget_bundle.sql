-- ===========================================================================
-- OBS stream widget — everything the /obs/stream widget needs, in one paste.
-- Combines 036, 037 and 038. Safe to run more than once.
-- ===========================================================================

-- --- 036: giveaway runtime -------------------------------------------------
-- The widget shows how long a giveaway has been running, which needs the
-- round's start time to survive a widget reload. The admin page already
-- tracked it, but only in local React state.
ALTER TABLE giveaway_state
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- Backfill a round that is already live so the badge isn't blank until the
-- next one starts. updated_at is the closest stand-in we have.
UPDATE giveaway_state
   SET started_at = updated_at
 WHERE started_at IS NULL
   AND status <> 'idle';

-- --- 037: deposit / cashout events -----------------------------------------
-- deposits_withdrawals only ever holds running totals, so nothing recorded
-- that money had *just* moved — which is what the widget announces.
CREATE TABLE IF NOT EXISTS transaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('deposit', 'cashout')),
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_events_created_at
  ON transaction_events (created_at DESC);

ALTER TABLE transaction_events ENABLE ROW LEVEL SECURITY;

-- Postgres has no CREATE POLICY IF NOT EXISTS, so drop first to stay re-runnable.
DROP POLICY IF EXISTS "Allow all operations on transaction_events" ON transaction_events;
CREATE POLICY "Allow all operations on transaction_events"
  ON transaction_events FOR ALL USING (true);

-- The widget listens for INSERTs over Realtime. A new table is NOT in the
-- supabase_realtime publication by default, so without this the subscription
-- connects happily and simply never fires.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'transaction_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE transaction_events;
  END IF;
END
$$;

-- --- 038: Kick channel -----------------------------------------------------
-- The channel lived under two keys that drifted apart: 035 seeds
-- 'kick_channel_name', but every client that starts chat polling reads
-- 'kick_username' — and nothing in the app ever writes that one, so a value
-- set by hand during testing ("roshtein") stuck. Point both at the real channel.
INSERT INTO settings (key, value)
VALUES
  ('kick_username', 'trinidoslots'),
  ('kick_channel_name', 'trinidoslots')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- --- verify ----------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'giveaway_state' AND column_name = 'started_at')            AS started_at_column,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name = 'transaction_events')                                       AS events_table,
  (SELECT count(*) FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'transaction_events')      AS realtime_enabled,
  (SELECT value FROM settings WHERE key = 'kick_username')                         AS kick_username;
