-- Make transaction_events the ledger for deposits and cashouts.
--
-- Until now the app only kept running totals: deposits_withdrawals was read as
-- a single totals row in /admin/settings and as a pile of rows to sum in the OBS
-- widget, and nothing recorded *when* an individual movement happened or let one
-- be corrected afterwards. transaction_events already exists (037) for the OBS
-- announcements, so it becomes the single source of truth and the totals are
-- derived from it.
--
-- Safe to run more than once.

-- Tie each ledger row back to the deposits_withdrawals row it came from, so the
-- backfill below can be repeated without duplicating anything.
ALTER TABLE transaction_events
  ADD COLUMN IF NOT EXISTS source_id UUID;

-- An optional label, e.g. which casino the movement was on.
ALTER TABLE transaction_events
  ADD COLUMN IF NOT EXISTS note TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_events_source
  ON transaction_events (source_id, kind)
  WHERE source_id IS NOT NULL;

-- Backfill: every historical deposits_withdrawals row becomes up to two ledger
-- entries, keeping its original timestamp so the history stays in order.
INSERT INTO transaction_events (kind, amount, created_at, source_id)
SELECT 'deposit', deposit_amount, created_at, id
  FROM deposits_withdrawals
 WHERE COALESCE(deposit_amount, 0) > 0
ON CONFLICT (source_id, kind) DO NOTHING;

INSERT INTO transaction_events (kind, amount, created_at, source_id)
SELECT 'cashout', withdraw_amount, created_at, id
  FROM deposits_withdrawals
 WHERE COALESCE(withdraw_amount, 0) > 0
ON CONFLICT (source_id, kind) DO NOTHING;

-- --- verify ----------------------------------------------------------------
SELECT
  (SELECT count(*) FROM transaction_events)                                   AS ledger_rows,
  (SELECT COALESCE(sum(amount), 0) FROM transaction_events
    WHERE kind = 'deposit')                                                   AS total_deposited,
  (SELECT COALESCE(sum(amount), 0) FROM transaction_events
    WHERE kind = 'cashout')                                                   AS total_cashed_out,
  (SELECT COALESCE(sum(deposit_amount), 0) FROM deposits_withdrawals)         AS legacy_deposits,
  (SELECT COALESCE(sum(withdraw_amount), 0) FROM deposits_withdrawals)        AS legacy_withdrawals;
