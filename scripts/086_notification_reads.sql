-- Read and unread for the bell in the top bar.
--
-- Notifications are worked out from what happened (raffle wins, store
-- purchases; app/api/notifications), so there is no notifications table to
-- flag. What is stored is what the user has read:
--
--   notifications_read_before  "Mark all as read": everything up to then.
--   notifications_read_ids     single notifications read since, by id.
--                              Cleared by the next "Mark all as read", and
--                              capped by the route, so it stays short.
--
-- On the account rather than in the browser, so phone and PC agree. users is
-- private since 072 (server only), so no policy is needed. Safe to re-run.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notifications_read_before timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notifications_read_ids    text[] NOT NULL DEFAULT '{}';

-- Verify: two columns.
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'users' AND column_name LIKE 'notifications_read%'
 ORDER BY column_name;
