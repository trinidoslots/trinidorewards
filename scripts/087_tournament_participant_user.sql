-- Tournament players linked to their site account.
--
-- Players were stored by name only (tournament_participants.username), typed
-- in by hand in Admin > Tournaments, so nothing tied a player to an account
-- and the profile never counted those tournaments. The admin now picks the
-- player from the site's users (search by name, with Kick ID and site ID in
-- the list); the picked account's id is kept here. A name typed by hand for
-- someone without an account still works and leaves this empty.
--
-- ON DELETE SET NULL: deleting a user (scripts/085) keeps the bracket intact,
-- only the link goes. Safe to re-run.

ALTER TABLE public.tournament_participants
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_participants_user_id
  ON public.tournament_participants (user_id) WHERE user_id IS NOT NULL;

-- Verify: the column exists.
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'tournament_participants' AND column_name = 'user_id';
