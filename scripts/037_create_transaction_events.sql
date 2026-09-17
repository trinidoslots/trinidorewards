-- deposits_withdrawals only ever holds running totals, so nothing recorded that
-- a deposit or cashout had *just happened* — which is what the OBS stream widget
-- announces. One row per movement, written alongside the totals update.
CREATE TABLE IF NOT EXISTS transaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('deposit', 'cashout')),
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- The widget only ever reads the last few seconds of this table.
CREATE INDEX IF NOT EXISTS idx_transaction_events_created_at
  ON transaction_events (created_at DESC);

ALTER TABLE transaction_events ENABLE ROW LEVEL SECURITY;

-- Postgres has no CREATE POLICY IF NOT EXISTS, so drop first to keep this
-- script safe to re-run.
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
