-- "NEW RECORD!" in the stream column: a slot's best win beaten.
--
-- Needs 067 (slot_meta, now_playing.best_win) to have been run first.
--
-- Two ways a record happens, and both end as a row in record_events, which
-- the overlay streams in exactly like points_events:
--
--   1. Opening a bonus. /admin/bonushunt/opening writes hunt_bonuses.result
--      straight from the browser, so the check lives in a trigger here rather
--      than in a route — any path that saves a result is covered, and there is
--      no second place to forget.
--   2. Typing a higher Best Win on /admin/obs/now-playing. That route already
--      holds the service role and inserts the row itself.
--
-- "Best win" means the figure the now-playing bar shows: the pinned one in
-- slot_meta if there is one, otherwise the biggest result across the hunts.
-- A slot with no best win yet has nothing to beat, so its first result is not
-- announced.

CREATE TABLE IF NOT EXISTS record_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_name     TEXT NOT NULL,
  provider      TEXT,
  image_url     TEXT,
  win           NUMERIC(14,2) NOT NULL,
  -- NULL when the bet is unknown (a typed record without a multiplier).
  multiplier    NUMERIC(14,2),
  previous_best NUMERIC(14,2),
  source        TEXT NOT NULL CHECK (source IN ('opening', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_record_events_created_at
  ON record_events (created_at DESC);

-- SELECT only, like points_events: the overlay reads with the anon key, and an
-- insert policy would let anyone put a fake record on stream.
ALTER TABLE record_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "record_events are readable" ON record_events;
CREATE POLICY "record_events are readable"
  ON record_events FOR SELECT USING (true);

-- --- the check on opening -----------------------------------------------------

-- SECURITY DEFINER because slot_meta, now_playing and record_events have no
-- write policy, and the opening page writes as a signed-in user.
CREATE OR REPLACE FUNCTION announce_record_from_hunt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  -- The same key lib/now-playing.ts nameKey() builds.
  v_key      TEXT := lower(regexp_replace(trim(coalesce(NEW.game_name, '')), '\s+', ' ', 'g'));
  v_pinned   NUMERIC;
  v_image    TEXT;
  v_provider TEXT;
  v_hunts    NUMERIC;
  v_previous NUMERIC;
BEGIN
  IF v_key = '' OR NEW.result IS NULL OR NEW.result <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT best_win, image_url, provider
    INTO v_pinned, v_image, v_provider
    FROM slot_meta
   WHERE name_key = v_key;

  -- Every other bonus on this game. This row is left out so correcting a
  -- result is measured against the rest, not against its own old value.
  SELECT max(result)
    INTO v_hunts
    FROM hunt_bonuses
   WHERE lower(trim(game_name)) = lower(trim(NEW.game_name))
     AND id <> NEW.id
     AND result IS NOT NULL;

  v_previous := coalesce(v_pinned, v_hunts);

  IF v_previous IS NULL OR v_previous <= 0 OR NEW.result <= v_previous THEN
    RETURN NEW;
  END IF;

  INSERT INTO record_events (slot_name, provider, image_url, win, multiplier, previous_best, source)
  VALUES (
    trim(NEW.game_name),
    coalesce(nullif(trim(NEW.provider), ''), v_provider),
    coalesce(nullif(trim(NEW.image_url), ''), v_image),
    NEW.result,
    CASE WHEN NEW.bet_size > 0 THEN round(NEW.result / NEW.bet_size, 2) END,
    v_previous,
    'opening'
  );

  -- A pinned figure that has just been beaten is out of date. Unpinning hands
  -- the slot back to "biggest result across the hunts", which now is this one
  -- — and which keeps itself right if this result is corrected later.
  IF v_pinned IS NOT NULL THEN
    UPDATE slot_meta SET best_win = NULL, updated_at = now() WHERE name_key = v_key;
  END IF;

  -- If this game is on the now-playing bar, its Best Win moves with it.
  UPDATE now_playing
     SET best_win = NEW.result, updated_at = now()
   WHERE id = 1
     AND lower(regexp_replace(trim(coalesce(slot_name, '')), '\s+', ' ', 'g')) = v_key;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- An announcement must never cost a saved result. Whatever went wrong here
  -- (067 not run, say), the opening carries on and the record is just not shown.
  RAISE WARNING 'announce_record_from_hunt: %', SQLERRM;
  RETURN NEW;
END
$fn$;

REVOKE ALL ON FUNCTION announce_record_from_hunt() FROM PUBLIC;

DROP TRIGGER IF EXISTS hunt_bonuses_announce_record ON hunt_bonuses;
CREATE TRIGGER hunt_bonuses_announce_record
  AFTER UPDATE OF result ON hunt_bonuses
  FOR EACH ROW
  WHEN (NEW.result IS DISTINCT FROM OLD.result AND NEW.result IS NOT NULL)
  EXECUTE FUNCTION announce_record_from_hunt();

-- --- realtime -----------------------------------------------------------------

-- Without this the overlay's subscription connects and never fires.
DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'record_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE record_events;
  END IF;
END
$pub$;

-- --- verify -------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM record_events)                                      AS records,
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'record_events')      AS rls_on,
  (SELECT count(*) FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'record_events')     AS in_realtime_publication,
  (SELECT count(*) FROM pg_trigger
    WHERE tgname = 'hunt_bonuses_announce_record')                           AS trigger_installed,
  (SELECT to_regclass('public.slot_meta') IS NOT NULL)                       AS slot_meta_exists;
