-- Wager feeds as rows, so a second one does not need a deploy.
--
-- 015 already tried this and it is why api_url and api_key had to be dropped in
-- 059: they sat on `leaderboards`, which the public page and the landing page
-- both read from the browser with select("*"), and that table has no RLS. The
-- key went to every visitor.
--
-- The difference here is not "keys in the database" — it is WHERE and under
-- WHAT.
--
--   * its own table, which no public query touches
--   * RLS on and deliberately NO policy, so anon and authenticated cannot see
--     the table at all; only the service-role client, on the server, can.
--     Same shape as redemption_payouts in 057.
--   * the admin panel writes through /api/admin/leaderboard-providers, which
--     checks requireAdmin and uses the service client — not through the
--     browser's anon key
--   * reading back never returns the key, only a short preview of it
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS leaderboard_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What the admin calls it. Unique so two rows cannot both be "EarnLab".
  name TEXT NOT NULL UNIQUE,

  -- --- the request ----------------------------------------------------------
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  -- Header the key travels in. 'x-api-key' here; 'Authorization' elsewhere.
  auth_header TEXT NOT NULL DEFAULT 'x-api-key',
  -- Prefix inside that header, e.g. 'Bearer'. NULL sends the key by itself.
  auth_scheme TEXT,
  start_param TEXT NOT NULL DEFAULT 'startDate',
  end_param   TEXT NOT NULL DEFAULT 'endDate',
  -- NULL means the provider takes no limit parameter.
  limit_param TEXT DEFAULT 'limit',
  -- iso | iso_ms | date | unix_s | unix_ms
  date_format TEXT NOT NULL DEFAULT 'iso',
  max_limit INTEGER NOT NULL DEFAULT 50,
  max_range_days INTEGER NOT NULL DEFAULT 31,
  -- How long a result may be reused. Match the provider's own cache: asking
  -- faster than it refreshes returns the same bytes and spends the rate limit.
  cache_minutes INTEGER NOT NULL DEFAULT 30,

  -- --- the response ---------------------------------------------------------
  -- Dot paths. rows_path '' means the response IS the array of players.
  rows_path TEXT NOT NULL DEFAULT 'data',
  username_path TEXT NOT NULL DEFAULT 'user.username',
  score_path TEXT NOT NULL DEFAULT 'totalWagered',
  avatar_path TEXT DEFAULT 'user.avatar',
  -- The provider's account id. Kept in leaderboard_entries.user_ref, because a
  -- masked name is not something you can pay.
  ref_path TEXT DEFAULT 'user.id',
  -- A flag that is false on a failure served with HTTP 200.
  success_path TEXT DEFAULT 'success',

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leaderboard_providers_date_format_check') THEN
    ALTER TABLE leaderboard_providers
      ADD CONSTRAINT leaderboard_providers_date_format_check
      CHECK (date_format IN ('iso', 'iso_ms', 'date', 'unix_s', 'unix_ms'));
  END IF;
END $$;

-- Which feed a board is fetched from. NULL keeps using the environment
-- variables, so every board that exists today carries on unchanged.
ALTER TABLE leaderboards
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES leaderboard_providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leaderboards_provider ON leaderboards (provider_id);

-- --- the lock ----------------------------------------------------------------
-- RLS with no policy is the point, not an oversight. Postgres denies every row
-- to every role that does not bypass RLS, and service_role does. Adding any
-- policy here hands the table — and the keys in it — back to the anon key.
ALTER TABLE leaderboard_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on leaderboard_providers" ON leaderboard_providers;
DROP POLICY IF EXISTS "leaderboard_providers are readable" ON leaderboard_providers;
DROP POLICY IF EXISTS "Public can view leaderboard_providers" ON leaderboard_providers;

-- Belt and braces: revoke the table grants Supabase hands the public roles by
-- default, so a policy added later by accident still finds no privilege behind
-- it.
REVOKE ALL ON leaderboard_providers FROM anon, authenticated;

-- --- verify ------------------------------------------------------------------
-- rls_enabled must be true and policy_count must be 0. Any other combination
-- means the keys are reachable with the public anon key.
SELECT
  c.relrowsecurity                                                          AS rls_enabled,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'leaderboard_providers')     AS policy_count,
  (SELECT count(*) FROM leaderboard_providers)                              AS providers,
  (SELECT count(*) FROM leaderboards WHERE provider_id IS NOT NULL)          AS boards_with_provider
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'leaderboard_providers';
