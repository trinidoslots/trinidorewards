-- 083: slot challenges.
--
-- The streamer sets a challenge on a slot (hit 1,000x, or win $500, with at
-- least a given bet) with a prize and a number of winners. Viewers claim it on
-- /challenges by submitting the Stake bet id ("casino:519440954076"); the
-- admin reviews the submissions and approves or rejects each one.
--
-- challenges             public-read (the page lists them), admin-write.
-- challenge_submissions  private. Viewers submit through /api/challenges/claim,
--                        which checks the signed site session and writes with
--                        the service role; admins review from the panel.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_name     TEXT NOT NULL,
  provider      TEXT,
  image_url     TEXT,
  -- What has to be hit: a multiplier (e.g. 1000 for 1,000x) or a payout in $.
  target_type   TEXT NOT NULL DEFAULT 'multiplier' CHECK (target_type IN ('multiplier', 'payout')),
  target_value  NUMERIC NOT NULL CHECK (target_value > 0),
  min_bet       NUMERIC NOT NULL DEFAULT 0 CHECK (min_bet >= 0),
  prize_amount  NUMERIC NOT NULL DEFAULT 0 CHECK (prize_amount >= 0),
  prize_type    TEXT NOT NULL DEFAULT 'cash' CHECK (prize_type IN ('cash', 'points')),
  -- NULL: no limit. Once this many submissions are approved it is completed.
  max_winners   INTEGER CHECK (max_winners IS NULL OR max_winners > 0),
  starts_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL: runs until ended by hand or its winners are all in.
  ends_at       TIMESTAMPTZ,
  -- Set by "End now" in the panel.
  ended_at      TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_starts ON public.challenges (starts_at DESC);

CREATE TABLE IF NOT EXISTS public.challenge_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  username      TEXT NOT NULL,
  -- The digits of "casino:519440954076"; the Stake link is built from them.
  bet_id        TEXT NOT NULL CHECK (bet_id ~ '^[0-9]{1,30}$'),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note          TEXT,
  reviewed_by   TEXT,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_submissions_challenge ON public.challenge_submissions (challenge_id, status);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_created ON public.challenge_submissions (created_at DESC);

-- One bet can only ever be submitted once, to any challenge.
CREATE UNIQUE INDEX IF NOT EXISTS challenge_submissions_bet_unique ON public.challenge_submissions (bet_id);
-- One live claim per viewer per challenge; after a rejection they may try again.
CREATE UNIQUE INDEX IF NOT EXISTS challenge_submissions_user_unique
  ON public.challenge_submissions (challenge_id, user_id)
  WHERE status IN ('pending', 'approved');

-- --- access --------------------------------------------------------------------

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.challenges FROM anon, authenticated;
REVOKE ALL ON public.challenge_submissions FROM anon, authenticated;

-- Challenges: everyone reads; only admins write (the panel uses the browser
-- client with the admin's session).
GRANT SELECT ON public.challenges TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.challenges TO authenticated;

DROP POLICY IF EXISTS "challenges are public" ON public.challenges;
CREATE POLICY "challenges are public" ON public.challenges FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin full access" ON public.challenges;
CREATE POLICY "admin full access" ON public.challenges FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Submissions: admins only. No public policy at all.
GRANT SELECT, UPDATE, DELETE ON public.challenge_submissions TO authenticated;

DROP POLICY IF EXISTS "admin full access" ON public.challenge_submissions;
CREATE POLICY "admin full access" ON public.challenge_submissions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- --- nav -------------------------------------------------------------------------

-- The Challenges link, on. Switch it in Admin > Modules like any other.
INSERT INTO public.modules (module_name, display_name, description, category, is_enabled)
VALUES ('challenges', 'Challenges', 'Shows /challenges in the navigation', 'community', true)
ON CONFLICT (module_name) DO NOTHING;

-- --- check ------------------------------------------------------------------------
-- Expected: both tables with rls_on = true.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN ('challenges', 'challenge_submissions');
