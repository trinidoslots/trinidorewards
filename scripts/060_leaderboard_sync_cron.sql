-- Leaderboard sync: every 30 minutes, from Postgres.
--
-- Vercel cannot do this. On Hobby a cron job may only fire once a day, and both
-- of the two slots are already spent on finalize and the raffle draw. pg_cron
-- has no such limit, costs nothing, and runs next to the data it writes.
--
-- The schedule matches the feed rather than being picked: it caches a result for
-- 30 minutes against the exact startDate-endDate-limit, so a run every 15
-- minutes would fetch the same bytes twice and spend half the 2-per-minute
-- budget doing it.
--
-- Postgres does nothing here but ring the doorbell. The fetching, the mapping,
-- the masking and the writing all stay in TypeScript in /api/leaderboards/sync,
-- where they are testable and deploy with the rest of the app.
--
-- ============================================================================
-- BEFORE RUNNING: set the two placeholders at the bottom — the site URL and
-- CRON_SECRET, which must be the same value as the Vercel environment variable
-- of that name.
-- ============================================================================

-- --- 1. extensions ----------------------------------------------------------
-- pg_cron schedules, pg_net makes the HTTP call. Both ship with Supabase.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- --- 2. what the sync upserts against ---------------------------------------
-- The job matches a player by the feed's account id. Without this constraint
-- every run would insert fifty fresh rows instead of updating the ones there,
-- and ON CONFLICT would error rather than silently doing the wrong thing.
--
-- Partial, because imported CSV rows have no user_ref and several NULLs in one
-- board must stay allowed.
CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_entries_board_user_ref_key
  ON leaderboard_entries (leaderboard_id, user_ref)
  WHERE user_ref IS NOT NULL;

-- The job writes updated_at on every row.
ALTER TABLE leaderboard_entries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- --- 3. the secret ----------------------------------------------------------
-- In Vault, not in the job definition: cron.job is readable by anyone who can
-- read the schema, and the command text would otherwise carry the bearer token
-- in clear.
--
-- >>> REPLACE 'PUT-YOUR-CRON-SECRET-HERE' with the same value as Vercel's
--     CRON_SECRET. Nothing else in this file needs the secret.
DO $$
DECLARE
  v_secret TEXT := 'PUT-YOUR-CRON-SECRET-HERE';
BEGIN
  IF v_secret = 'PUT-YOUR-CRON-SECRET-HERE' THEN
    RAISE EXCEPTION 'Set the CRON_SECRET placeholder in step 3 before running this script.';
  END IF;

  -- Re-runnable: replace the stored value rather than adding a second one.
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'leaderboard_cron_secret') THEN
    PERFORM vault.update_secret(
      (SELECT id FROM vault.secrets WHERE name = 'leaderboard_cron_secret'),
      v_secret
    );
  ELSE
    PERFORM vault.create_secret(v_secret, 'leaderboard_cron_secret', 'Bearer token for /api/leaderboards/sync');
  END IF;
END $$;

-- --- 4. the job -------------------------------------------------------------
-- >>> REPLACE https://trinidorewards.com if the site lives anywhere else.
--     It must be the public URL: pg_net calls it from outside Vercel.
SELECT cron.unschedule('leaderboard-sync')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'leaderboard-sync');

SELECT cron.schedule(
  'leaderboard-sync',
  -- Minute 0 and minute 30 of every hour.
  '0,30 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://trinidorewards.com/api/leaderboards/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
         WHERE name = 'leaderboard_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    -- The route walks the boards one at a time to stay inside the feed's
    -- 2-requests-per-minute limit, so it is allowed to take a while.
    timeout_milliseconds := 55000
  );
  $job$
);

-- --- verify ------------------------------------------------------------------
-- The job, as scheduled.
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'leaderboard-sync';

-- After the first run has had a chance to fire (:30 or :00), this shows how it
-- went. pg_net is asynchronous: cron.job_run_details says the call was made,
-- net._http_response holds what came back.
--
--   SELECT status, return_message, start_time
--     FROM cron.job_run_details
--    WHERE jobname = 'leaderboard-sync'
--    ORDER BY start_time DESC LIMIT 5;
--
--   SELECT status_code, content::text, created
--     FROM net._http_response
--    ORDER BY created DESC LIMIT 5;
--
-- A 200 with {"synced":1,"failed":0,...} is the job working.
-- A 401 means the Vault secret and Vercel's CRON_SECRET do not match.

SELECT
  (SELECT count(*) FROM cron.job WHERE jobname = 'leaderboard-sync')          AS job_scheduled,
  (SELECT count(*) FROM vault.secrets WHERE name = 'leaderboard_cron_secret') AS secret_stored,
  (SELECT count(*) FROM leaderboards WHERE source = 'api')                    AS api_boards;
