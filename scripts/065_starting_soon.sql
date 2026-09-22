-- The "starting soon" screen: one countdown, set from the admin panel and read
-- by the OBS source at /obs/starting-soon.
--
-- One row, forced by the CHECK — there is only ever one stream about to start,
-- and a table that can hold two invites the question of which one is showing.
-- Same shape as giveaway_state.

CREATE TABLE IF NOT EXISTS starting_soon (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- The moment being counted down to. NULL is legitimate: the screen then shows
  -- the headline with no clock under it, which is what you want when the stream
  -- is starting "soon" rather than at a stated time.
  starts_at   TIMESTAMPTZ,

  headline    TEXT NOT NULL DEFAULT 'Starting soon',
  subline     TEXT,

  -- Shown once the countdown reaches zero, instead of counting into negative
  -- numbers. A stream that is five minutes late should not say -05:00 on it.
  ended_text  TEXT NOT NULL DEFAULT 'Any moment now',

  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO starting_soon (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS: readable by anyone, writable by nobody through the API.
--
-- The OBS source is a browser with the public anon key and no session, so it
-- has to be able to read this. Writes go through /api/admin/starting-soon,
-- which checks the caller is an admin and then uses the service role — that
-- key bypasses RLS, so no write policy is needed and the absence of one is
-- what stops anyone with the anon key setting your countdown.
ALTER TABLE starting_soon ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "starting_soon readable by everyone" ON starting_soon;
CREATE POLICY "starting_soon readable by everyone"
  ON starting_soon FOR SELECT USING (true);

-- The overlay listens for UPDATEs so the clock changes the moment it is saved.
-- A new table is NOT in the supabase_realtime publication by default, so
-- without this the subscription connects happily and simply never fires.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'starting_soon'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE starting_soon;
  END IF;
END
$$;

-- Verify.
SELECT
  (SELECT count(*) FROM starting_soon)                                         AS rows_present,
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'starting_soon')        AS rls_on,
  (SELECT count(*) FROM pg_policies
    WHERE tablename = 'starting_soon')                                         AS policy_count,
  EXISTS (SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND tablename = 'starting_soon')                                  AS realtime_enabled;
