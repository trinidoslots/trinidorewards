-- Stop the list pages reading every entry row just to count them.
--
-- /raffles and /admin/raffles were fetching the whole raffle_entries table on
-- every load, and /tournaments the whole tournament_participants table, only to
-- add them up per row. That is a full scan that grows forever, on a page
-- anybody can hit.
--
-- The counter columns already exist; nothing was keeping them current. This
-- backfills them from the truth, and the app maintains them from here on.
--
-- Safe to run more than once.

ALTER TABLE raffles ADD COLUMN IF NOT EXISTS entrant_count INTEGER NOT NULL DEFAULT 0;

UPDATE raffles r
   SET tickets_sold  = COALESCE(counts.tickets, 0),
       entrant_count = COALESCE(counts.entrants, 0)
  FROM (
    SELECT raffle_id,
           SUM(COALESCE(tickets_purchased, 0)) AS tickets,
           COUNT(*)                            AS entrants
      FROM raffle_entries
     GROUP BY raffle_id
  ) AS counts
 WHERE counts.raffle_id = r.id;

-- Raffles with no entries at all are not in the subquery above.
UPDATE raffles
   SET tickets_sold = 0, entrant_count = 0
 WHERE id NOT IN (SELECT DISTINCT raffle_id FROM raffle_entries WHERE raffle_id IS NOT NULL);

UPDATE tournaments t
   SET current_participants = COALESCE(counts.players, 0)
  FROM (
    SELECT tournament_id, COUNT(*) AS players
      FROM tournament_participants
     GROUP BY tournament_id
  ) AS counts
 WHERE counts.tournament_id = t.id;

UPDATE tournaments
   SET current_participants = 0
 WHERE id NOT IN (SELECT DISTINCT tournament_id FROM tournament_participants WHERE tournament_id IS NOT NULL);

-- --- indexes ------------------------------------------------------------------
-- The lookups the app does on every page, none of which had an index.
CREATE INDEX IF NOT EXISTS idx_redemptions_user_id       ON redemptions (user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_created_at    ON redemptions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_board ON leaderboard_entries (leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_raffles_end_date          ON raffles (end_date DESC);
CREATE INDEX IF NOT EXISTS idx_tournaments_type_created  ON tournaments (tournament_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stream_schedule_upcoming  ON stream_schedule (starts_at DESC);
-- users.username is matched case-insensitively when a win is logged by name.
CREATE INDEX IF NOT EXISTS idx_users_username_lower      ON users (lower(username));

-- --- verify ------------------------------------------------------------------
-- The stored counts should now equal the live ones. Expect zero rows back.
SELECT r.id, r.title, r.tickets_sold, r.entrant_count
  FROM raffles r
  LEFT JOIN (
    SELECT raffle_id, SUM(COALESCE(tickets_purchased, 0)) AS tickets, COUNT(*) AS entrants
      FROM raffle_entries GROUP BY raffle_id
  ) c ON c.raffle_id = r.id
 WHERE r.tickets_sold IS DISTINCT FROM COALESCE(c.tickets, 0)
    OR r.entrant_count IS DISTINCT FROM COALESCE(c.entrants, 0);
