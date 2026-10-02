-- Discord as a second way into an account.
--
-- An account is still a Kick account: points, Botrix and the leaderboard all
-- hang off kick_id. Discord is linked to it from Profile > Settings >
-- Connections (signed in with Kick), and from then on "Continue with Discord"
-- signs in to that same account. A Discord account linked to nothing cannot
-- sign in — it would have no Kick account to be.
--
-- users is private since 072 (no public read, server only), so these columns
-- need no policy of their own. Safe to re-run.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS discord_id        text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS discord_username  text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS discord_avatar    text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS discord_linked_at timestamptz;

-- One Discord account, one site account.
CREATE UNIQUE INDEX IF NOT EXISTS users_discord_id_key ON public.users (discord_id) WHERE discord_id IS NOT NULL;

-- Verify: four columns and the index.
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'users' AND column_name LIKE 'discord_%'
 ORDER BY column_name;
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_discord_id_key';
