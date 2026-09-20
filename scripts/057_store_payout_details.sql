-- Where a bought item should be sent.
--
-- Each store item now says what it needs before it can be bought: a casino
-- username for an on-site tip, or a coin, a network and a wallet for crypto.
-- NULL keeps the old behaviour, so every item that exists today still buys in
-- one click until someone sets it.
--
-- Safe to run more than once.

ALTER TABLE store_items ADD COLUMN IF NOT EXISTS payout_method TEXT;

-- Nothing else in the codebase writes this column, so a typo would otherwise
-- sit in the database until someone tried to buy the item.
DO $chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_items_payout_method_check'
  ) THEN
    ALTER TABLE store_items ADD CONSTRAINT store_items_payout_method_check
      CHECK (payout_method IS NULL OR payout_method IN ('onsite_tip', 'crypto'));
  END IF;
END
$chk$;

-- --- the details themselves -------------------------------------------------

-- A separate table rather than columns on redemptions, and this is the whole
-- reason: redemptions is read straight from the browser with the public anon
-- key (the admin redemption list and the profile page both do it). A wallet
-- address on that table would be readable by anyone who opened the site and
-- looked at the network tab.
--
-- So this follows user_payment_methods instead: RLS on, no policy at all,
-- nothing reachable with the anon key. Access goes through the API, which is
-- the only place that knows who is asking:
--   /api/store/purchase          - the buyer, writing their own, service role
--   /api/admin/redemptions       - an admin, by their Supabase session
CREATE TABLE IF NOT EXISTS redemption_payouts (
  redemption_id UUID PRIMARY KEY,
  method TEXT NOT NULL CHECK (method IN ('onsite_tip', 'crypto')),
  -- On-site tip.
  username TEXT,
  -- Crypto. chain is stored even for single-network coins, so the admin never
  -- has to work out which network BTC meant on the day.
  crypto TEXT,
  chain TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A row that carries a username but no address, or the other way round, is a
  -- payout somebody has to guess at. Better rejected at the door.
  CONSTRAINT redemption_payouts_shape CHECK (
    (method = 'onsite_tip' AND username IS NOT NULL AND address IS NULL)
    OR
    (method = 'crypto' AND crypto IS NOT NULL AND chain IS NOT NULL AND address IS NOT NULL)
  )
);

-- No migration ever created `redemptions`, so its id column cannot be assumed
-- to be UUID. The foreign key is worth having (it cascades the details away
-- with the redemption) but not worth failing the whole script over, so it is
-- added only if it can be.
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'redemption_payouts_redemption_fk'
  ) THEN
    BEGIN
      ALTER TABLE redemption_payouts
        ADD CONSTRAINT redemption_payouts_redemption_fk
        FOREIGN KEY (redemption_id) REFERENCES redemptions(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'redemption_payouts: foreign key not added (%). The table works without it.', SQLERRM;
    END;
  END IF;
END
$fk$;

ALTER TABLE redemption_payouts ENABLE ROW LEVEL SECURITY;

-- Any policy from an earlier attempt would defeat the point above.
DROP POLICY IF EXISTS "Allow all operations on redemption_payouts" ON redemption_payouts;
DROP POLICY IF EXISTS "redemption_payouts are readable" ON redemption_payouts;

-- --- verify -----------------------------------------------------------------
-- Expect rls_enabled = true and policies = 0. Anything else means a wallet
-- address is readable with the public anon key.
SELECT
  c.relname                                            AS table_name,
  c.relrowsecurity                                     AS rls_enabled,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'redemption_payouts') AS policies,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'store_items' AND column_name = 'payout_method')   AS payout_method_column,
  (SELECT count(*) FROM pg_constraint
    WHERE conname = 'redemption_payouts_redemption_fk')                   AS foreign_key
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'redemption_payouts';
