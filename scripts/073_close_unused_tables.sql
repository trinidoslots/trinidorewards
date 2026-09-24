-- Close the tables nothing reads.
--
-- 072 opened public read on every table not on its private list. These eight
-- came out of the live database's listing, not from this repo: no page, route
-- or overlay reads any of them. They are left over from a chat webhook that
-- has since been removed (see the note at the top of 056), and hold chat logs,
-- per-user messages and giveaway entries, none of which needs to be public.
--
-- Admins keep full access through 072's "admin full access" policy, and the
-- server's service role is unaffected. Safe to re-run; a table that does not
-- exist is skipped.

DO $close$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_messages', 'chat_messages', 'kick_chat_messages', 'kick_channel_monitor_status',
    'giveaway_entries', 'giveaway_sessions', 'giveaway_winners_log', 'obs_banners'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "public read" ON public.%I', t);
    END IF;
  END LOOP;
END
$close$;

-- Verify: none of the eight should list "public read" any more.
SELECT tablename, string_agg(policyname, ', ' ORDER BY policyname) AS policies
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('user_messages', 'chat_messages', 'kick_chat_messages', 'kick_channel_monitor_status',
                     'giveaway_entries', 'giveaway_sessions', 'giveaway_winners_log', 'obs_banners')
 GROUP BY tablename
 ORDER BY tablename;
