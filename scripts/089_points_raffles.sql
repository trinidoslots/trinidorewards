-- Points raffles: type a keyword in Kick chat within the time, win points.
--
-- Like the Kick giveaway, but run by the server instead of a browser tab: the
-- Kick bot's chat webhook (lib/kick-bot/chat.ts) writes everyone who sends the
-- keyword while the raffle is open into points_raffle_entries, and when the
-- time is up draw_points_raffle() picks the winners, pays them and logs the
-- wins in one statement. The bot announces both ends in chat.
--
-- Only entrants with an account on the site (users.kick_id) can win: points
-- live on that account. Service role only. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.points_raffles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Matched like the giveaway: the whole message, trimmed, case-insensitive.
  keyword        text NOT NULL CHECK (length(btrim(keyword)) BETWEEN 1 AND 100),
  points_each    integer NOT NULL CHECK (points_each BETWEEN 1 AND 1000000),
  winner_count   integer NOT NULL CHECK (winner_count BETWEEN 1 AND 100),
  starts_at      timestamptz NOT NULL DEFAULT now(),
  ends_at        timestamptz NOT NULL,
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'drawn', 'cancelled')),
  created_by     text,
  drawn_at       timestamptz,
  entry_count    integer,
  eligible_count integer,
  -- [{ username, kick_id, user_id }]
  winners        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

-- One raffle open at a time: two keywords running at once would be confusing
-- in chat, and the page shows one.
CREATE UNIQUE INDEX IF NOT EXISTS points_raffles_one_open
  ON public.points_raffles ((true)) WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_points_raffles_created_at
  ON public.points_raffles (created_at DESC);

CREATE TABLE IF NOT EXISTS public.points_raffle_entries (
  raffle_id  uuid NOT NULL REFERENCES public.points_raffles(id) ON DELETE CASCADE,
  kick_id    text NOT NULL,
  username   text NOT NULL,
  entered_at timestamptz NOT NULL DEFAULT now(),
  -- Typing the keyword twice is still one entry.
  PRIMARY KEY (raffle_id, kick_id)
);

ALTER TABLE public.points_raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_raffle_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.points_raffles FROM anon, authenticated;
REVOKE ALL ON public.points_raffle_entries FROM anon, authenticated;

-- Draws a raffle whose time is up (or any open one, with p_force): random
-- winners among entrants with an account, points added with an increment,
-- each win logged as paid. The row lock makes it happen once however many
-- callers (webhook, admin page, End button) arrive together; the later ones
-- get the drawn row back with "already": true.
CREATE OR REPLACE FUNCTION public.draw_points_raffle(p_raffle_id uuid, p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r        points_raffles%ROWTYPE;
  v_entries  integer;
  v_eligible integer;
  v_winners  jsonb;
BEGIN
  SELECT * INTO r FROM points_raffles WHERE id = p_raffle_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF r.status <> 'open' THEN
    RETURN to_jsonb(r) || jsonb_build_object('already', true);
  END IF;
  IF NOT p_force AND r.ends_at > now() THEN
    RETURN to_jsonb(r) || jsonb_build_object('too_early', true);
  END IF;

  SELECT count(*) INTO v_entries FROM points_raffle_entries e WHERE e.raffle_id = r.id;
  SELECT count(DISTINCT u.id) INTO v_eligible
    FROM points_raffle_entries e
    JOIN users u ON u.kick_id = e.kick_id
   WHERE e.raffle_id = r.id;

  -- Data-modifying CTEs run once whether or not the final SELECT reads them.
  WITH eligible AS (
    SELECT DISTINCT ON (u.id) u.id AS user_id, e.kick_id, e.username
      FROM points_raffle_entries e
      JOIN users u ON u.kick_id = e.kick_id
     WHERE e.raffle_id = r.id
     ORDER BY u.id
  ),
  picked AS (
    SELECT * FROM eligible ORDER BY random() LIMIT r.winner_count
  ),
  bumped AS (
    UPDATE users u
       SET points_balance = COALESCE(u.points_balance, 0) + r.points_each
      FROM picked p
     WHERE u.id = p.user_id
    RETURNING u.id AS user_id, p.kick_id, p.username
  ),
  logged AS (
    INSERT INTO win_logs (user_id, username, source, source_ref, prize, points, status, paid_at)
    SELECT b.user_id, b.username, 'giveaway', 'Points raffle: ' || r.keyword,
           r.points_each || ' points', r.points_each, 'paid', now()
      FROM bumped b
    RETURNING 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('username', b.username, 'kick_id', b.kick_id, 'user_id', b.user_id)), '[]'::jsonb)
    INTO v_winners
    FROM bumped b;

  UPDATE points_raffles
     SET status = 'drawn',
         drawn_at = now(),
         entry_count = v_entries,
         eligible_count = v_eligible,
         winners = v_winners
   WHERE id = r.id
  RETURNING * INTO r;

  RETURN to_jsonb(r);
END;
$fn$;

-- SECURITY DEFINER and it pays out points: the service role only.
REVOKE ALL ON FUNCTION public.draw_points_raffle(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.draw_points_raffle(uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.draw_points_raffle(uuid, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.draw_points_raffle(uuid, boolean) TO service_role;

-- Verify: both tables with RLS on, and the function.
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('points_raffles', 'points_raffle_entries');
SELECT proname FROM pg_proc WHERE proname = 'draw_points_raffle';
