-- The schedule as a week of streams, not a flat list.
--
-- A day holds several segments — the games or blocks you plan to run — each
-- with its own colour, in the order you mean to play them. A day can also be
-- marked off, which is different from a day with nothing on it: one says "not
-- streaming", the other says "nothing announced yet".
--
-- Safe to run more than once.

ALTER TABLE stream_schedule
  -- One of the named accents, so the board palette stays the palette.
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS is_day_off BOOLEAN NOT NULL DEFAULT false,
  -- Position within its day. Ties fall back to starts_at.
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_stream_schedule_day
  ON stream_schedule (starts_at, sort_order);

-- --- verify ------------------------------------------------------------------
SELECT color, count(*) FROM stream_schedule GROUP BY color ORDER BY color;
