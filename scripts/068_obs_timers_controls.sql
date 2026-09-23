-- 068 — Timers you can drive, and tables only the server can write.
--
-- Run this AFTER the deploy that ships the new admin page, not before. The
-- write policies dropped at the bottom are the ones the old page used, so
-- between running this and deploying, the old page cannot save.

-- ---------------------------------------------------------------- timers

ALTER TABLE obs_timers
  -- What a restart returns to. Timers were created from a wall-clock end
  -- time, so nothing recorded how long they were meant to run.
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 300,

  -- Non-null means paused, and holds what was left at that moment. end_time
  -- is meaningless while it is set: resuming recomputes end_time from now.
  ADD COLUMN IF NOT EXISTS paused_remaining_seconds INTEGER,

  -- What happens at zero. 'hide' is what the widget always did.
  ADD COLUMN IF NOT EXISTS on_zero TEXT NOT NULL DEFAULT 'hide',
  ADD COLUMN IF NOT EXISTS zero_message TEXT,

  -- Order on the strip. Without it the widget showed whatever the database
  -- happened to return first.
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE obs_timers DROP CONSTRAINT IF EXISTS obs_timers_on_zero_check;
ALTER TABLE obs_timers
  ADD CONSTRAINT obs_timers_on_zero_check CHECK (on_zero IN ('hide', 'hold', 'message'));

-- Give the existing rows a duration to go back to: whatever they have left,
-- floored at a minute so a finished timer does not restart into nothing.
UPDATE obs_timers
SET duration_seconds = GREATEST(60, CEIL(EXTRACT(EPOCH FROM (end_time - now()))))::INTEGER
WHERE duration_seconds = 300;

-- And an order: oldest first, matching how they were listed.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS position
  FROM obs_timers
)
UPDATE obs_timers SET sort_order = ranked.position
FROM ranked WHERE obs_timers.id = ranked.id AND obs_timers.sort_order = 0;

-- ------------------------------------------------------------------ info

ALTER TABLE obs_info ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS position
  FROM obs_info
)
UPDATE obs_info SET sort_order = ranked.position
FROM ranked WHERE obs_info.id = ranked.id AND obs_info.sort_order = 0;

-- ------------------------------------------------------- who may write

-- Both tables drive what is on stream, and both were writable by anyone
-- holding the public anon key — obs_timers through USING (true) policies for
-- insert, update and delete, and obs_info through having no RLS at all. The
-- key ships in the browser bundle of every page on the site.
--
-- Reads stay public: the overlay is a browser source with no session, and it
-- has to read them. Writes now go through /api/admin/obs-timers and
-- /api/admin/obs-info, which check the admin session and use the service
-- role, so no policy needs to allow them.

ALTER TABLE obs_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE obs_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow updates to timers" ON obs_timers;
DROP POLICY IF EXISTS "Allow insert timers" ON obs_timers;
DROP POLICY IF EXISTS "Allow delete timers" ON obs_timers;

DROP POLICY IF EXISTS "Allow public read access to active timers" ON obs_timers;
CREATE POLICY "obs_timers read" ON obs_timers FOR SELECT USING (true);

DROP POLICY IF EXISTS "obs_info read" ON obs_info;
CREATE POLICY "obs_info read" ON obs_info FOR SELECT USING (true);

-- Realtime carries the changes to the overlay; the widget subscribes to both.
ALTER PUBLICATION supabase_realtime ADD TABLE obs_timers;
