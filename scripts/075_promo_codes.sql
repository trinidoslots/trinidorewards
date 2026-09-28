-- Promo codes: the admin makes a code worth N points, viewers redeem it on
-- /redeem, and a code can be put in the stream widget's event column.
--
-- Redeeming happens in one function, redeem_promo_code(), so the checks and the
-- credit cannot come apart: the code row is locked while it runs, "once per
-- account" is a unique constraint rather than a read-then-write, and the points
-- are added in place (points_balance + n) so a concurrent change to the balance
-- is never written over. Only the server's service role may call it.
--
-- Visibility: the codes themselves are private. The one exception is a code
-- that is active AND switched on for the stream — the overlay reads those with
-- the anon key, and anyone watching the stream can see it anyway. Every other
-- code stays unreadable, so they cannot be listed and redeemed from outside.
--
-- 072's lockdown only covered the tables that existed when it ran, so these
-- close themselves. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stored upper-case; lib/promo-codes.ts normalises what people type.
  code           TEXT NOT NULL UNIQUE CHECK (code = upper(code) AND length(code) BETWEEN 3 AND 32),
  points         INTEGER NOT NULL CHECK (points > 0 AND points <= 10000000),
  -- NULL: as many accounts as want it (each still only once).
  max_uses       INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count     INTEGER NOT NULL DEFAULT 0,
  -- New codes start switched off; the admin activates them when it is time.
  is_active      BOOLEAN NOT NULL DEFAULT false,
  show_on_stream BOOLEAN NOT NULL DEFAULT false,
  -- When it last went on stream; orders it among the other event cards.
  shown_at       TIMESTAMPTZ,
  created_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id    UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  username   TEXT,
  points     INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);

-- For a database where an earlier copy of this script created the table with
-- codes active by default.
ALTER TABLE public.promo_codes ALTER COLUMN is_active SET DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_code ON public.promo_code_redemptions (code_id, created_at DESC);

-- --- access ---------------------------------------------------------------------

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.promo_codes FROM anon, authenticated;
REVOKE ALL ON public.promo_code_redemptions FROM anon, authenticated;
GRANT SELECT ON public.promo_codes TO anon, authenticated;

DROP POLICY IF EXISTS "promo codes on stream are readable" ON public.promo_codes;
CREATE POLICY "promo codes on stream are readable"
  ON public.promo_codes FOR SELECT
  USING (is_active AND show_on_stream);

-- --- redeeming ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code TEXT, p_user_id UUID, p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_code    promo_codes%ROWTYPE;
  v_balance NUMERIC;
BEGIN
  SELECT * INTO v_code
    FROM promo_codes
   WHERE code = upper(trim(p_code))
     FOR UPDATE;

  -- A disabled code answers exactly like one that does not exist, so trying
  -- codes cannot tell anyone which ones were real.
  IF NOT FOUND OR NOT v_code.is_active THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  IF v_code.max_uses IS NOT NULL AND v_code.uses_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'used_up');
  END IF;

  BEGIN
    INSERT INTO promo_code_redemptions (code_id, user_id, username, points)
    VALUES (v_code.id, p_user_id, p_username, v_code.points);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already');
  END;

  UPDATE users
     SET points_balance = coalesce(points_balance, 0) + v_code.points
   WHERE id = p_user_id
  RETURNING points_balance INTO v_balance;

  -- Raising undoes the redemption row above too: no account, no claim.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'redeem_promo_code: no user %', p_user_id;
  END IF;

  UPDATE promo_codes
     SET uses_count = uses_count + 1, updated_at = now()
   WHERE id = v_code.id;

  RETURN jsonb_build_object('ok', true, 'code', v_code.code, 'points', v_code.points, 'balance', v_balance);
END
$fn$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(TEXT, UUID, TEXT) TO service_role;

-- --- realtime -------------------------------------------------------------------

-- So a code switched on for the stream appears at once rather than on the
-- overlay's next poll. Realtime applies the policy above, so the overlay is only
-- ever sent codes it may see.
DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'promo_codes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.promo_codes;
  END IF;
END
$pub$;

-- --- verify ---------------------------------------------------------------------

SELECT
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.promo_codes'::regclass)            AS codes_rls_on,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.promo_code_redemptions'::regclass) AS redemptions_rls_on,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'promo_codes')                           AS code_policies,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'promo_code_redemptions')                AS redemption_policies,
  (SELECT count(*) FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'promo_codes')                        AS in_realtime,
  (SELECT to_regprocedure('public.redeem_promo_code(text, uuid, text)') IS NOT NULL)          AS function_installed;
