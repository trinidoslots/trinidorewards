-- Tournaments on the overlay: push updates instead of waiting for a poll.
--
-- The OBS sources and the public tournament page subscribe to postgres_changes
-- on these three tables. A table is not in the supabase_realtime publication
-- until it is added explicitly, and the subscribe succeeds either way — it
-- simply never fires — so without this the overlay only updates on its 5s
-- poller.
--
-- The poller stays as a safety net; this makes a payout appear on stream the
-- moment it is entered rather than up to five seconds later.
--
-- Safe to run more than once.

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['tournaments', 'tournament_participants', 'tournament_matches']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = target
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target);
    END IF;
  END LOOP;
END $$;

-- --- verify ------------------------------------------------------------------
-- Expect all three rows back.
SELECT tablename
  FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime'
   AND tablename IN ('tournaments', 'tournament_participants', 'tournament_matches')
 ORDER BY tablename;
