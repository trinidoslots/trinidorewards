-- Leaderboards: tell wagered and earned apart.
--
-- wager_amount carried one number under a name that only described half of
-- what boards are actually run on. A wager race ranks on volume; a profit
-- race ranks on what players took home. Those are different columns and a
-- board has to say which one it ranks by.
--
-- Run this BEFORE pushing the deploy, or right after it.
--
-- Reading survives either order: every leaderboard read asks for the whole row
-- and falls back to wager_amount while this has not run. Writing does not —
-- importing a CSV or saving a board sends total_wagered and ranking_metric, and
-- those fail until the columns exist. So the public page keeps working
-- whichever way round it goes; the admin needs this to have run.

-- 1. The rename, and the new column beside it. Guarded so a second run is a
--    no-op rather than an error — these get pasted twice more often than not.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leaderboard_entries'
      and column_name = 'wager_amount'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leaderboard_entries'
      and column_name = 'total_wagered'
  ) then
    alter table public.leaderboard_entries rename column wager_amount to total_wagered;
  end if;
end $$;

alter table public.leaderboard_entries
  add column if not exists total_earned numeric not null default 0;

-- 2. Which number the board is ranked and displayed by.
alter table public.leaderboards
  add column if not exists ranking_metric text not null default 'wagered';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leaderboards_ranking_metric_check'
  ) then
    alter table public.leaderboards
      add constraint leaderboards_ranking_metric_check
      check (ranking_metric in ('wagered', 'earned'));
  end if;
end $$;

-- 3. Sorting happens on whichever of the two a board uses, on every load.
create index if not exists idx_leaderboard_entries_wagered
  on public.leaderboard_entries (leaderboard_id, total_wagered desc);

create index if not exists idx_leaderboard_entries_earned
  on public.leaderboard_entries (leaderboard_id, total_earned desc);

-- 4. PostgREST caches the table shape and will keep answering 400 with
--    "could not find the column" until it is told to look again.
notify pgrst, 'reload schema';
