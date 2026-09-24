-- Lock the database down: nothing writes with the public key any more.
--
-- Needs 071 (admin_accounts keyed on the on-site account). Safe to re-run.
-- Run it AFTER the code from the same commit is deployed: that code moved
-- every write the public site made with the anon key onto the server.
--
-- What changes
--
--   The anon key ships in every page, so anything it may do, anyone may do.
--   Until now it could write most tables: set anyone's points, rewrite a
--   raffle, read every user's wallet addresses and the settings secrets.
--
--   After this, for every table in public:
--
--     - Writes (insert / update / delete) only for an admin session: a
--       Supabase login minted for a Kick account tagged in admin_accounts
--       (see is_admin() below). The server's service role bypasses RLS as
--       before, which is how the site itself writes.
--     - Reads stay public where the site and the OBS overlays read with the
--       anon key, and are closed on the tables that hold personal data.
--     - settings: only the three keys the public pages read are visible.
--     - win_logs: readable, but not its note or user id.
--
--   Every existing policy on these tables is dropped first, so no forgotten
--   "allow all" policy from an earlier migration survives.
--
-- If something on the site stops working after this, the cause is a read or
-- write this could not see coming; the fix is a policy for that one table,
-- not reverting the whole script.

-- --- who is an admin, inside the database -----------------------------------------
--
-- The session's JWT carries app_metadata.kick_id and app_metadata.site_user_id
-- (written by the service role at login, lib/admin-auth.ts); both must match
-- one admin_accounts row. SECURITY DEFINER so it can read admin_accounts,
-- which nobody else can.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM admin_accounts a
     WHERE a.kick_id = (auth.jwt() -> 'app_metadata' ->> 'kick_id')
       AND a.user_id::text = (auth.jwt() -> 'app_metadata' ->> 'site_user_id')
  )
$fn$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- --- policies, table by table ----------------------------------------------------

DO $lock$
DECLARE
  t   record;
  p   record;
  -- Personal or internal: no public read at all.
  private_tables text[] := ARRAY[
    'users', 'redemptions', 'redemption_payouts', 'user_payment_methods',
    'user_site_usernames', 'chat_activity', 'points_grants',
    'points_grant_entries', 'advent_calendar_claims'
  ];
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);

    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t.relname LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t.relname);
    END LOOP;

    -- The anon key never writes. TRUNCATE is not covered by RLS at all, so
    -- it goes for everyone but the server.
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon', t.relname);
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM authenticated', t.relname);

    -- admin_accounts: the server only. No policy, no grants.
    IF t.relname = 'admin_accounts' THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t.relname);
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE POLICY "admin full access" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t.relname
    );

    IF t.relname = ANY (private_tables) THEN
      CONTINUE;
    ELSIF t.relname = 'settings' THEN
      EXECUTE $p$CREATE POLICY "public settings" ON public.settings FOR SELECT TO anon, authenticated
                 USING (key IN ('hunt_source', 'obs_view_mode', 'total_given_away'))$p$;
    ELSE
      EXECUTE format('CREATE POLICY "public read" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t.relname);
    END IF;
  END LOOP;
END
$lock$;

-- win_logs: the homepage lists recent winners; the admin's note and the
-- account id are not part of that.
DO $wins$
BEGIN
  IF to_regclass('public.win_logs') IS NOT NULL THEN
    REVOKE SELECT ON public.win_logs FROM anon, authenticated;
    GRANT SELECT (id, username, source, source_ref, prize, amount, points, status, created_at)
      ON public.win_logs TO anon, authenticated;
  END IF;
END
$wins$;

-- --- functions --------------------------------------------------------------------
--
-- Nothing in the site calls a database function with the anon key; the three
-- it calls go through the service role. So every function in public is taken
-- away from anon and authenticated, except is_admin(), which the policies
-- above need. Trigger functions keep working: a trigger does not check
-- EXECUTE when it fires.

DO $funcs$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND p.proname <> 'is_admin'
       -- Functions owned by extensions are theirs to manage.
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END
$funcs$;

-- New tables and functions start closed too, instead of Supabase's default
-- of granting everything to anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- --- verify -------------------------------------------------------------------------
--
-- Every row should say rls_on = true. "public read" appears on the public
-- tables only; private tables list just "admin full access"; admin_accounts
-- lists nothing.

SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_on,
       COALESCE(string_agg(p.policyname, ', ' ORDER BY p.policyname), '(none)') AS policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
 GROUP BY c.relname, c.relrowsecurity
 ORDER BY c.relname;
