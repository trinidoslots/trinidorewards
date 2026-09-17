-- Hiding finished raffles, and drawing automatic ones the minute they close.
--
-- === 1. Hiding =============================================================
-- Finished raffles stay on the page as they are. This is for the ones you want
-- out of the way without losing the record of who won.

ALTER TABLE raffles ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_raffles_visible ON raffles (end_date DESC) WHERE is_hidden = false;

-- === 2. Drawing on time ====================================================
-- The app nudges automatic raffles along whenever somebody loads a page, and
-- the hosting plan allows one cron a day. Neither draws a raffle *at* the
-- minute it closes.
--
-- This schedules a call to the app's own sweep endpoint every minute, so there
-- is still only one implementation of the draw — the database just presses the
-- button. Both extensions ship with Supabase but are not enabled by default.
--
-- If either CREATE EXTENSION fails on your plan, skip this section: the page
-- nudge and the daily cron still work, they are just not to-the-minute.
--
-- >>> Set this to your own domain before running. <<<
--     It has to be the deployed site, not localhost — the database calls it.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  site_url text := 'https://trinidorewards.com';
BEGIN
  -- Re-runnable: drop the old schedule before adding it back.
  PERFORM cron.unschedule('draw-due-raffles')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'draw-due-raffles');

  PERFORM cron.schedule(
    'draw-due-raffles',
    '* * * * *',
    format(
      $job$
      SELECT net.http_post(
        url     := %L,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := '{"due": true}'::jsonb
      );
      $job$,
      site_url || '/api/raffles/draw'
    )
  );
END $$;

-- --- verify ------------------------------------------------------------------
-- Expect one row, schedule "* * * * *", active = true.
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'draw-due-raffles';
