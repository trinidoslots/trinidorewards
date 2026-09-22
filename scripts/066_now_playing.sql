-- The slot currently being played, shown by the OBS source at /obs/now-playing.
--
-- One row, forced by the CHECK: there is only ever one game on screen. Same
-- shape as giveaway_state and starting_soon.
--
-- slot_name NULL means nothing is playing, and the overlay renders nothing at
-- all rather than an empty bar — an OBS source that cannot disappear has to be
-- toggled by hand every time the streamer leaves a game.

CREATE TABLE IF NOT EXISTS now_playing (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  slot_name   TEXT,
  provider    TEXT,
  image_url   TEXT,

  -- "25,000x" as written on the casino's own page. Text, not a number: it is a
  -- label copied from the site, the site writes it with a thousands separator,
  -- and parsing it to a number only to format it back risks rendering 25000x
  -- where the game itself says 25,000x.
  max_win     TEXT,

  -- "Only on Stake" and the like. Null for most games.
  badge       TEXT,

  -- Which side set it, so the admin panel can say where the current value came
  -- from. 'extension' | 'admin'.
  source      TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('extension', 'admin')),

  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO now_playing (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS: readable by anyone, writable by nobody through the API.
--
-- The OBS source is a browser holding nothing but the anon key, so it has to be
-- able to read this. Writes go through two routes that both hold the service
-- role: /api/extension/now-playing (the extension's static bearer token) and
-- /api/admin/now-playing (a signed-in admin). The absence of a write policy is
-- what stops anyone with the anon key changing what is on your stream.
ALTER TABLE now_playing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "now_playing readable by everyone" ON now_playing;
CREATE POLICY "now_playing readable by everyone"
  ON now_playing FOR SELECT USING (true);

-- The overlay listens for UPDATEs so the bar changes the moment the button is
-- pressed. A new table is NOT in the supabase_realtime publication by default,
-- so without this the subscription connects happily and simply never fires.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'now_playing'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE now_playing;
  END IF;
END
$$;

-- Verify.
SELECT
  (SELECT count(*) FROM now_playing)                                    AS rows_present,
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'now_playing')    AS rls_on,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'now_playing')     AS policy_count,
  EXISTS (SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND tablename = 'now_playing')                             AS realtime_enabled;
