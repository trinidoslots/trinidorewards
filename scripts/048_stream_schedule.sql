-- The stream schedule: when you are on, entered by hand.
--
-- Times are stored as instants. The admin form takes them in whatever zone the
-- browser is in and the public page renders them back in the viewer's own — an
-- audience spread across timezones should not have to do the arithmetic.
--
-- Public to read, because that is the entire point of the page. Writing is left
-- to the authenticated admin, as on the other tables.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS stream_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  -- Optional: plenty of streams have no announced end.
  ends_at TIMESTAMPTZ,
  -- Free text, e.g. "Bonus Hunt", "Tournament", "Slots".
  category TEXT,
  -- Somewhere to send people, if it is not the usual channel.
  url TEXT,
  -- Kept rather than deleted, so a cancelled stream still shows as cancelled
  -- instead of quietly vanishing from the page.
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_schedule_starts_at ON stream_schedule (starts_at);

ALTER TABLE stream_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view the schedule" ON stream_schedule;
CREATE POLICY "Public can view the schedule" ON stream_schedule
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert schedule entries" ON stream_schedule;
CREATE POLICY "Authenticated users can insert schedule entries" ON stream_schedule
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update schedule entries" ON stream_schedule;
CREATE POLICY "Authenticated users can update schedule entries" ON stream_schedule
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete schedule entries" ON stream_schedule;
CREATE POLICY "Authenticated users can delete schedule entries" ON stream_schedule
  FOR DELETE USING (auth.role() = 'authenticated');

-- The nav link is gated on a modules row. Without one the page is unreachable
-- even once it exists, so make sure it is there — left switched off, since
-- turning it on is your call.
INSERT INTO modules (module_name, display_name, description, category, is_enabled)
VALUES ('schedule', 'Schedule', 'Shows /schedule in the navigation', 'main', false)
ON CONFLICT (module_name) DO NOTHING;

-- --- verify ------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM stream_schedule)                                  AS entries,
  (SELECT count(*) FROM modules WHERE module_name = 'schedule')           AS schedule_module;
