-- Repairs the index the sync job upserts against.
--
-- 060 created it partial:
--
--   CREATE UNIQUE INDEX … ON leaderboard_entries (leaderboard_id, user_ref)
--     WHERE user_ref IS NOT NULL;
--
-- and the sync failed on every board with
--
--   there is no unique or exclusion constraint matching the ON CONFLICT
--   specification
--
-- Postgres will only use a partial index for ON CONFLICT when the statement
-- repeats its predicate — ON CONFLICT (a, b) WHERE user_ref IS NOT NULL. The
-- Supabase client's onConflict option takes column names and nothing else, so
-- the index can never be matched from there.
--
-- The predicate was pointless anyway. A unique index treats NULLs as distinct
-- from one another, so imported CSV rows — which have no user_ref — can still
-- sit in the same board many times over without the partial clause. Dropping it
-- costs nothing and makes the index usable.
--
-- Safe to run more than once. Run 060 first.

DROP INDEX IF EXISTS public.leaderboard_entries_board_user_ref_key;

CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_entries_board_user_ref_key
  ON public.leaderboard_entries (leaderboard_id, user_ref);

-- --- verify ------------------------------------------------------------------
-- indpred must come back NULL. Anything else means the index is still partial
-- and the sync will keep failing the same way.
SELECT
  i.relname       AS index_name,
  ix.indisunique  AS is_unique,
  ix.indpred      AS partial_predicate
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
WHERE t.relname = 'leaderboard_entries'
  AND i.relname = 'leaderboard_entries_board_user_ref_key';
