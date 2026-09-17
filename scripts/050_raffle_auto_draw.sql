-- Whether a raffle draws itself when it closes, or waits for you.
--
-- Defaults to false: a raffle that picks a winner while nobody is watching is
-- not what you want during a stream, and silently changing the behaviour of
-- every existing raffle would be worse.
--
-- Safe to run more than once.

ALTER TABLE raffles ADD COLUMN IF NOT EXISTS auto_draw BOOLEAN NOT NULL DEFAULT false;

-- The sweep looks for closed, undrawn, automatic raffles. Without this it reads
-- the whole table every time a page asks.
CREATE INDEX IF NOT EXISTS idx_raffles_auto_draw_due
  ON raffles (end_date)
  WHERE auto_draw = true AND winner_username IS NULL;

-- --- verify ------------------------------------------------------------------
SELECT count(*) FILTER (WHERE auto_draw) AS automatic,
       count(*) FILTER (WHERE NOT auto_draw) AS manual
  FROM raffles;
