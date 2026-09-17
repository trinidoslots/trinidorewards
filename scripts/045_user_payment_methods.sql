-- Where a user wants their payouts sent.
--
-- Deliberately locked down harder than the rest of the schema. Site usernames
-- are a nickname; a PayPal address or a wallet is the thing an attacker
-- actually wants, and the public anon key can read anything a permissive policy
-- allows. So: RLS on, and no policy at all. Nothing reachable with the anon key
-- can read or write this table.
--
-- Access goes through the API instead, which is the only place that can tell
-- who is asking:
--   /api/profile/payment-methods  - the owner, by the user_db_id cookie
--   /api/admin/users/[id]         - an admin, by their Supabase session
-- Both use the service role, which bypasses RLS by design.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS user_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- paypal / crypto / bank / skrill / other — free text so a new one does not
  -- need a migration.
  method TEXT NOT NULL,
  -- Optional qualifier: the network for a wallet ("BTC", "LTC"), the bank name.
  label TEXT,
  -- The address, email or account itself.
  value TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user_id
  ON user_payment_methods (user_id);

-- The same method twice with the same value is a duplicate, not a second
-- account, and the profile page would otherwise let it be added repeatedly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_payment_methods_unique
  ON user_payment_methods (user_id, method, value);

ALTER TABLE user_payment_methods ENABLE ROW LEVEL SECURITY;

-- Any policy left over from an earlier attempt would defeat the point above.
DROP POLICY IF EXISTS "Users can view own payment methods" ON user_payment_methods;
DROP POLICY IF EXISTS "Users can insert own payment methods" ON user_payment_methods;
DROP POLICY IF EXISTS "Users can update own payment methods" ON user_payment_methods;
DROP POLICY IF EXISTS "Users can delete own payment methods" ON user_payment_methods;

-- --- verify ------------------------------------------------------------------
-- Expect the table with rls_enabled = true and zero policies.
SELECT
  c.relname                                             AS table_name,
  c.relrowsecurity                                      AS rls_enabled,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'user_payment_methods') AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'user_payment_methods';
