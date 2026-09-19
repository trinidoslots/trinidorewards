-- Modules: make the category column mean something.
--
-- Until now the navigation's groups were written out inside main-nav.tsx and
-- the category column was read by nothing. The admin panel offered its own
-- unrelated list — main, bonus_hunt, community, seasonal, hidden — which did
-- not include "Stream", the group the nav was actually drawing. Picking a
-- category wrote a value and changed nothing.
--
-- The nav reads the column now. That makes whatever is currently stored
-- suddenly load-bearing, and none of it was ever a deliberate choice: Schedule
-- and Stream Store sit under "community" because "stream" was not on the menu.
-- So this sets every row to the group the nav was really drawing it in, which
-- means the nav looks identical the moment this runs, and the dropdown starts
-- working from there.
--
-- Run it once, before or after the deploy. Unrecognised values are handled in
-- the app too, so neither order breaks the nav.

update public.modules set category = 'stream'
where lower(regexp_replace(module_name, '[\s-]+', '_', 'g')) in ('stream_store', 'store', 'streamstore', 'schedule');

update public.modules set category = 'bonuses'
where lower(regexp_replace(module_name, '[\s-]+', '_', 'g')) in
  ('active_bonuses', 'claim_bonuses', 'advent_calendar', 'advent', 'adventcalendar');

update public.modules set category = 'community'
where lower(regexp_replace(module_name, '[\s-]+', '_', 'g')) in
  ('bonus_hunt', 'bonushunt', 'hunt', 'leaderboard', 'leaderboards', 'raffles', 'raffle',
   'tournaments', 'tournament');

-- PostgREST caches the table shape; the column already exists, so this is only
-- here for the case where it does not.
notify pgrst, 'reload schema';

select module_name, category, is_enabled from public.modules order by category, module_name;
