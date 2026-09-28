-- Ranks: Moderator (a restricted admin) and Code User (a viewer with access to
-- Code-User-only store items, raffles and promo codes).
--
-- Needs 071/072 (admin_accounts, is_admin()) and 075 (promo_codes). Safe to re-run.
--
-- Moderator
--   A staff tag in admin_accounts like an admin, with role = 'moderator'.
--   They get the same kind of Supabase session at login, so the admin pages
--   they may use keep writing from the browser as before. What they can write
--   is decided HERE, not by which menu items they see:
--
--     - is_admin() is now true for role = 'admin' only, so none of 072's
--       "admin full access" policies apply to a moderator.
--     - is_moderator() is true for role = 'moderator', and has a write policy
--       on exactly the tables behind the pages they may use: Settings
--       (transactions, total given away), Opening Mode, Tournaments, Now
--       Playing, Predictions.
--     - Everything they may only look at (leaderboards, giveaway, raffles,
--       store items) is already publicly readable, so they need no read
--       policy; promo codes are read through the server.
--
-- Code User
--   users.is_code_user, set by an admin on /admin/users. store_items,
--   raffles and promo_codes gain code_user_only; the purchase route, the
--   raffle entry route and redeem_promo_code() refuse anyone else.

-- --- staff roles ----------------------------------------------------------------

ALTER TABLE public.admin_accounts ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';

DO $chk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_accounts_role_check') THEN
    ALTER TABLE public.admin_accounts
      ADD CONSTRAINT admin_accounts_role_check CHECK (role IN ('admin', 'moderator'));
  END IF;
END
$chk$;

-- The main admin is always an admin.
UPDATE public.admin_accounts SET role = 'admin' WHERE is_owner AND role <> 'admin';

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
       AND a.role = 'admin'
  )
$fn$;

CREATE OR REPLACE FUNCTION public.is_moderator()
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
       AND a.role = 'moderator'
  )
$fn$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_moderator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO anon, authenticated, service_role;

-- --- what a moderator may write ---------------------------------------------------

DO $mod$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- Settings: deposits and withdrawals
    'transaction_events',
    -- Opening Mode
    'opening_state', 'bonus_hunts', 'hunt_bonuses', 'prediction_windows', 'hunt_predictions',
    -- Tournaments
    'tournaments', 'tournament_participants', 'tournament_matches',
    -- Now Playing
    'now_playing', 'slot_meta'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "moderator access" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "moderator access" ON public.%I FOR ALL TO authenticated USING (public.is_moderator()) WITH CHECK (public.is_moderator())',
        t
      );
    END IF;
  END LOOP;
END
$mod$;

-- settings holds secrets, so a moderator gets the two keys their pages write
-- (Settings: total_given_away; Opening Mode: obs_view_mode) and nothing else.
DROP POLICY IF EXISTS "moderator settings" ON public.settings;
CREATE POLICY "moderator settings" ON public.settings FOR ALL TO authenticated
  USING (public.is_moderator() AND key IN ('total_given_away', 'obs_view_mode'))
  WITH CHECK (public.is_moderator() AND key IN ('total_given_away', 'obs_view_mode'));

-- --- Code User ----------------------------------------------------------------------

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_code_user BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.store_items ADD COLUMN IF NOT EXISTS code_user_only BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS code_user_only BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS code_user_only BOOLEAN NOT NULL DEFAULT false;

-- Redeeming now checks the rank too. Otherwise the same as 075.
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code TEXT, p_user_id UUID, p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_code    promo_codes%ROWTYPE;
  v_balance NUMERIC;
BEGIN
  SELECT * INTO v_code
    FROM promo_codes
   WHERE code = upper(trim(p_code))
     FOR UPDATE;

  -- A disabled code answers exactly like one that does not exist.
  IF NOT FOUND OR NOT v_code.is_active THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  IF v_code.code_user_only AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = p_user_id AND is_code_user
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'code_users_only');
  END IF;

  IF v_code.max_uses IS NOT NULL AND v_code.uses_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'used_up');
  END IF;

  BEGIN
    INSERT INTO promo_code_redemptions (code_id, user_id, username, points)
    VALUES (v_code.id, p_user_id, p_username, v_code.points);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already');
  END;

  UPDATE users
     SET points_balance = coalesce(points_balance, 0) + v_code.points
   WHERE id = p_user_id
  RETURNING points_balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'redeem_promo_code: no user %', p_user_id;
  END IF;

  UPDATE promo_codes
     SET uses_count = uses_count + 1, updated_at = now()
   WHERE id = v_code.id;

  RETURN jsonb_build_object('ok', true, 'code', v_code.code, 'points', v_code.points, 'balance', v_balance);
END
$fn$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(TEXT, UUID, TEXT) TO service_role;

-- --- verify -------------------------------------------------------------------------

SELECT
  (SELECT string_agg(username || ' (' || role || ')', ', ' ORDER BY role, username) FROM admin_accounts) AS staff,
  (SELECT count(*) FROM pg_policies WHERE policyname IN ('moderator access', 'moderator settings'))     AS moderator_policies,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'users' AND column_name = 'is_code_user')
        OR (table_name IN ('store_items', 'raffles', 'promo_codes') AND column_name = 'code_user_only'))) AS code_user_columns_should_be_4;
