-- Deleting a user and the data held about them, for deletion requests
-- (Privacy Policy, section 10). Called from Admin > Users > a user > Delete.
--
-- One function, one transaction: everything goes or nothing does. Two kinds of
-- rows:
--
--   Theirs alone — deleted: the account (with its Discord link), wallets,
--   casino usernames, purchases and their payout details, raffle tickets,
--   tournament entries, hunt predictions, advent claims, promo code uses and
--   Kick chat activity.
--
--   Shared history — kept, name removed: the wins log, points grants,
--   challenge claims and raffle winners. Those rows also make up totals and
--   other people's results, so the row stays and the name becomes
--   "Deleted user".
--
-- Staff accounts are refused: change the rank to Viewer first, so removing
-- someone from the panel is always a deliberate step of its own.
--
-- Tables that only exist after a later migration are skipped when missing.
-- SECURITY DEFINER and executable by the server only. Safe to re-run.

CREATE OR REPLACE FUNCTION public.delete_user_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  u        record;
  kick     text;
  anon     constant text := 'Deleted user';
  result   jsonb := '{}'::jsonb;
  n        integer;
BEGIN
  SELECT * INTO u FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such user' USING ERRCODE = 'P0002';
  END IF;
  kick := NULLIF(u.kick_id::text, '');

  IF to_regclass('public.admin_accounts') IS NOT NULL
     AND EXISTS (SELECT 1 FROM admin_accounts WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'This is a staff account. Change its rank to Viewer first.' USING ERRCODE = 'P0001';
  END IF;

  -- Theirs alone: deleted. Purchases first, so their payout details
  -- (redemption_payouts, ON DELETE CASCADE) go with them.
  IF to_regclass('public.redemptions') IS NOT NULL THEN
    DELETE FROM redemptions WHERE user_id = p_user_id;
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('purchases', n);
  END IF;
  IF to_regclass('public.user_payment_methods') IS NOT NULL THEN
    DELETE FROM user_payment_methods WHERE user_id = p_user_id;
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('wallets', n);
  END IF;
  IF to_regclass('public.user_site_usernames') IS NOT NULL THEN
    DELETE FROM user_site_usernames WHERE user_id = p_user_id;
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('casino_accounts', n);
  END IF;
  IF to_regclass('public.raffle_entries') IS NOT NULL THEN
    DELETE FROM raffle_entries WHERE user_id = p_user_id;
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('raffle_entries', n);
  END IF;
  IF to_regclass('public.tournament_entries') IS NOT NULL THEN
    DELETE FROM tournament_entries WHERE user_id = p_user_id;
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('tournament_entries', n);
  END IF;
  IF to_regclass('public.hunt_predictions') IS NOT NULL THEN
    DELETE FROM hunt_predictions WHERE user_id = p_user_id;
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('predictions', n);
  END IF;
  IF to_regclass('public.advent_calendar_claims') IS NOT NULL THEN
    DELETE FROM advent_calendar_claims WHERE user_id = p_user_id;
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('advent_claims', n);
  END IF;
  IF to_regclass('public.promo_code_redemptions') IS NOT NULL THEN
    DELETE FROM promo_code_redemptions WHERE user_id = p_user_id;
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('promo_uses', n);
  END IF;
  IF kick IS NOT NULL AND to_regclass('public.chat_activity') IS NOT NULL THEN
    DELETE FROM chat_activity WHERE kick_id = kick;
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('chat_activity', n);
  END IF;

  -- Shared history: kept, name removed.
  IF to_regclass('public.win_logs') IS NOT NULL THEN
    UPDATE win_logs SET username = anon, user_id = NULL
     WHERE user_id = p_user_id OR lower(username) = lower(u.username);
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('wins_anonymised', n);
  END IF;
  IF to_regclass('public.points_grant_entries') IS NOT NULL THEN
    UPDATE points_grant_entries SET username = anon, kick_id = 'deleted', user_id = NULL
     WHERE user_id = p_user_id OR (kick IS NOT NULL AND kick_id = kick);
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('grants_anonymised', n);
  END IF;
  IF to_regclass('public.challenge_submissions') IS NOT NULL THEN
    UPDATE challenge_submissions SET username = anon, user_id = NULL WHERE user_id = p_user_id;
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('challenge_claims_anonymised', n);
  END IF;
  IF to_regclass('public.raffles') IS NOT NULL THEN
    UPDATE raffles SET winner_username = anon WHERE lower(winner_username) = lower(u.username);
    GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('raffle_wins_anonymised', n);
  END IF;

  -- Last: the account itself, and with it the Discord link. Anything still
  -- pointing at it with ON DELETE CASCADE goes too.
  DELETE FROM users WHERE id = p_user_id;

  RETURN result || jsonb_build_object('username', u.username);
END
$fn$;

REVOKE ALL ON FUNCTION public.delete_user_data(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_data(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data(uuid) TO service_role;

-- Verify: the function exists and only the server can run it.
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can_run,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_can_run
  FROM pg_proc p
 WHERE p.proname = 'delete_user_data';
