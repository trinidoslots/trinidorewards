-- The slot catalogue grows up, and the random slot gets a spinner on stream.
--
-- Safe to re-run.
--
-- slots
--   Was a spreadsheet import: a name and a provider. It now also holds the
--   artwork and Stake's own id for the game, so the full Stake catalogue can be
--   imported from /admin/slots (a JSON file made in your own browser on
--   stake.com — Stake refuses requests from servers) and re-imported later
--   without duplicates: (game_name, provider) stays the unique key.
--
-- random_slot_spins
--   One row per spin from /admin/random. The stream column (/obs/stream) and
--   the standalone /random-slot source read it with the anon key and animate
--   the reel themselves; the row carries the result and the strip of names the
--   reel runs through, so every viewer lands on the same slot at the same time.
--   Written only by the server (service role).

-- --- slots -------------------------------------------------------------------

ALTER TABLE public.slots ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.slots ADD COLUMN IF NOT EXISTS stake_slug TEXT;
ALTER TABLE public.slots ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.slots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Search is by name, anywhere in it. trigram makes ILIKE '%…%' fast on a few thousand rows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_slots_game_name_trgm ON public.slots USING gin (game_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_slots_provider ON public.slots (provider);

-- The import upserts on this. 010 created it; recreated here in case it went missing.
CREATE UNIQUE INDEX IF NOT EXISTS slots_unique_game_provider ON public.slots (game_name, provider);

-- --- random_slot_spins ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.random_slot_spins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_name      TEXT NOT NULL,
  provider       TEXT,
  image_url      TEXT,
  -- [{ "name": …, "provider": …, "image_url": … }, …] — what the reel shows on
  -- the way; the last entry is the result.
  reel           JSONB NOT NULL DEFAULT '[]'::jsonb,
  spin_ms        INTEGER NOT NULL DEFAULT 6000 CHECK (spin_ms BETWEEN 1000 AND 30000),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_random_slot_spins_started ON public.random_slot_spins (started_at DESC);

ALTER TABLE public.random_slot_spins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.random_slot_spins FROM anon, authenticated;
GRANT SELECT ON public.random_slot_spins TO anon, authenticated;

-- Read-only for everyone, like record_events: a result on stream is public anyway,
-- and without an insert policy nobody can put a fake spin on screen.
DROP POLICY IF EXISTS "random spins are readable" ON public.random_slot_spins;
CREATE POLICY "random spins are readable" ON public.random_slot_spins FOR SELECT USING (true);

DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'random_slot_spins'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.random_slot_spins;
  END IF;
END
$pub$;

-- --- verify ---------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM public.slots)                                             AS slots,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'slots' AND column_name IN ('image_url', 'stake_slug', 'source', 'updated_at')) AS new_slot_columns_should_be_4,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.random_slot_spins'::regclass) AS spins_rls_on,
  (SELECT count(*) FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'random_slot_spins')      AS spins_in_realtime;
