-- Leaderboards: say where the standings come from, and stop storing the key.
--
-- api_url and api_key were added in 015 for an import that was never built. The
-- admin panel wrote them and the hint on the field said so out loud: "Stored for
-- a future import. Not called yet."
--
-- They are worse than unused. The public leaderboard and the landing page both
-- read this table from the browser with "select *", so every visitor was handed
-- the stored key along with the prize pool. The address and the key now live in
-- LEADERBOARD_API_URL and LEADERBOARD_API_KEY, which never leave the server.
--
-- source already exists (042, default 'csv'). This only constrains it and makes
-- sure no row is sitting on NULL.
--
-- ============================================================================
-- RUN STEP 1 ON ITS OWN FIRST. Step 2 deletes those values permanently — if a
-- key you still need is in there, copy it out before going on.
-- ============================================================================

-- --- step 1: what is about to be dropped ------------------------------------
SELECT
  id,
  title,
  api_url,
  CASE
    WHEN api_key IS NULL OR api_key = '' THEN '(empty)'
    -- Enough to recognise which key it is, not enough to use it.
    ELSE left(api_key, 4) || '…' || right(api_key, 4)
  END AS api_key_preview
FROM leaderboards
WHERE api_url IS NOT NULL OR api_key IS NOT NULL;

-- --- step 2: the change ------------------------------------------------------
-- Safe to run more than once.

-- Older rows predate 042's default and can still be NULL.
UPDATE leaderboards SET source = 'csv' WHERE source IS NULL;

ALTER TABLE leaderboards
  ALTER COLUMN source SET DEFAULT 'csv',
  ALTER COLUMN source SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leaderboards_source_check') THEN
    ALTER TABLE leaderboards
      ADD CONSTRAINT leaderboards_source_check CHECK (source IN ('csv', 'api'));
  END IF;
END $$;

ALTER TABLE leaderboards
  DROP COLUMN IF EXISTS api_url,
  DROP COLUMN IF EXISTS api_key;

COMMENT ON COLUMN leaderboards.source IS
  'csv = rows imported into leaderboard_entries. api = standings fetched live by /api/leaderboards/standings.';

-- --- verify ------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM leaderboards)                            AS total_leaderboards,
  (SELECT count(*) FROM leaderboards WHERE source = 'csv')       AS csv_boards,
  (SELECT count(*) FROM leaderboards WHERE source = 'api')       AS api_boards,
  -- Both must read 0 once this has run.
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'leaderboards'
       AND column_name IN ('api_url', 'api_key'))                AS credential_columns_left;
