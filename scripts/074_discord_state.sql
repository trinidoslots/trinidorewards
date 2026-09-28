-- The Discord bot's memory.
--
-- The bot runs as API routes on Vercel (lib/discord/*), where nothing on disk
-- survives between requests. What the old standalone bot kept in
-- data/state.json lives here instead:
--
--   ids         which roles, channels and panel messages /setup made
--   live        whether the stream is live, and which Discord post announces it
--   once:<key>  one row per thing already announced, so a raffle or a
--               go-live is posted exactly once however many callers race
--
-- Nothing outside the server reads this. RLS is on with no policies, so anon
-- and signed-in users get nothing; the server's service role bypasses RLS.
-- 072's lockdown only covered the tables that existed when it ran, so this
-- one has to close itself. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.discord_state (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discord_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discord_state FROM anon, authenticated;

-- Verify: rls_enabled should be true and there should be no policies.
SELECT c.relrowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'discord_state') AS policies
  FROM pg_class c
 WHERE c.oid = 'public.discord_state'::regclass;
