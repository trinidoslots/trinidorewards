-- Who won what, across everything that has a winner.
--
-- Giveaways, predictions and bonus battles all produce a winner as a bare
-- username — a Kick chat name, not a row in users. So the username is what is
-- always recorded, and user_id is filled in when one can be matched. A win is
-- still a win for someone who has never signed in to the site, and losing that
-- record because they had no account would defeat the purpose.
--
-- Locked down like user_payment_methods: RLS on, no policy. Access goes through
-- the API, which knows who is asking:
--   /api/admin/wins     - an admin, by their Supabase session
--   /api/profile/wins   - the owner, by their user_db_id cookie
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS win_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nulled rather than deleted if the account goes: the win still happened.
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  -- giveaway | prediction | tournament | raffle | manual
  source TEXT NOT NULL DEFAULT 'manual',
  -- Which one: a prediction category, a tournament id, a raffle title.
  source_ref TEXT,
  prize TEXT NOT NULL,
  -- Cash value and points are both optional; a prize is often neither.
  amount DECIMAL(12, 2),
  points INTEGER,
  note TEXT,
  -- pending -> paid. Separate from the win itself, which is already a fact.
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_win_logs_user_id ON win_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_win_logs_created_at ON win_logs (created_at DESC);
-- The profile looks wins up by name when the account was never matched.
CREATE INDEX IF NOT EXISTS idx_win_logs_username ON win_logs (lower(username));

ALTER TABLE win_logs ENABLE ROW LEVEL SECURITY;

-- Any policy from an earlier attempt would defeat the point above.
DROP POLICY IF EXISTS "Public can view win logs" ON win_logs;
DROP POLICY IF EXISTS "Users can view own wins" ON win_logs;

-- --- verify ------------------------------------------------------------------
-- Expect rls_enabled = true and policies = 0.
SELECT
  c.relrowsecurity AS rls_enabled,
  (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'win_logs') AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'win_logs';
