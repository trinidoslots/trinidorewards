-- Chat activity, and points granted to whoever was talking.
--
-- There was an earlier attempt at this. It failed in four separate, silent
-- ways, and this file exists to not repeat any of them:
--
--   1. lib/active-users-tracker.ts kept the active set in a Map in process
--      memory. On Vercel each request can land in a different, freshly started
--      instance, so the Map was almost always empty. Activity lives in a table
--      now.
--   2. app/api/webhook wrote to user_messages, chat_messages and
--      kick_channel_monitor_status — none of which any migration ever created.
--      The insert failed, the error was logged, and the route still answered
--      200. Every table this feature touches is created here.
--   3. increment_points_by_username matched on the name, so a rename or a
--      different capitalisation updated zero rows without raising anything.
--      Everything below joins on kick_id, which is what Kick puts in the chat
--      payload (sender.id) and what the OAuth callback stores on users.
--   4. transaction_events (037) taught us that a new table is not in the
--      supabase_realtime publication by default: the subscription connects
--      happily and simply never fires. points_events is added to it at the
--      bottom.
--
-- Safe to run more than once.

-- --- who is talking ---------------------------------------------------------

-- One row per chatter, not per message. "Who wrote when" needs nothing more,
-- and it keeps this table small enough to never need pruning.
CREATE TABLE IF NOT EXISTS chat_activity (
  -- Kick's numeric user id, as a string. The join key everywhere.
  kick_id TEXT PRIMARY KEY,
  -- Last spelling seen. Display only — never matched on.
  username TEXT NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The only question ever asked of this table is "who was active since X".
CREATE INDEX IF NOT EXISTS idx_chat_activity_last_message
  ON chat_activity (last_message_at DESC);

-- Written by /api/chat/activity and read by /api/admin/points/*, both with the
-- service role. No policy at all, like win_logs: nothing reaches this with the
-- anon key, so a stranger cannot forge having been in chat.
ALTER TABLE chat_activity ENABLE ROW LEVEL SECURITY;

-- Recording a flush from a page that is reading chat.
--
-- Not a plain upsert, because two things have to be preserved that ON CONFLICT
-- ... SET cannot express on its own: batches may arrive out of order (so the
-- timestamp must never move backwards), and message_count accumulates instead
-- of being replaced by whatever this batch happened to see.
CREATE OR REPLACE FUNCTION record_chat_activity(p_rows JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO chat_activity (kick_id, username, last_message_at, message_count)
  SELECT r.kick_id, r.username, r.last_message_at, r.message_count
    FROM jsonb_to_recordset(p_rows) AS r(
      kick_id TEXT,
      username TEXT,
      last_message_at TIMESTAMPTZ,
      message_count INTEGER
    )
  ON CONFLICT (kick_id) DO UPDATE
     SET last_message_at = GREATEST(chat_activity.last_message_at, EXCLUDED.last_message_at),
         -- Only take the name from a batch that is actually newer, so a late
         -- flush cannot resurrect an old spelling.
         username = CASE
           WHEN EXCLUDED.last_message_at >= chat_activity.last_message_at THEN EXCLUDED.username
           ELSE chat_activity.username
         END,
         message_count = chat_activity.message_count + EXCLUDED.message_count;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION record_chat_activity(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_chat_activity(JSONB) FROM anon;
REVOKE ALL ON FUNCTION record_chat_activity(JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION record_chat_activity(JSONB) TO service_role;

-- --- what was granted -------------------------------------------------------

CREATE TABLE IF NOT EXISTS points_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The window that was asked for, kept so a grant can be explained later.
  window_minutes INTEGER NOT NULL,
  points_each INTEGER NOT NULL,
  user_count INTEGER NOT NULL DEFAULT 0,
  total_points BIGINT NOT NULL DEFAULT 0,
  granted_by TEXT,
  -- A double-click, a retry or a flaky connection must produce one grant, not
  -- two. The client sends a key; the second call returns the first result.
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_points_grants_idempotency
  ON points_grants (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_points_grants_created_at
  ON points_grants (created_at DESC);

-- The ledger. Balance before and after are both recorded so a grant can be
-- audited, explained to someone who asks, or reversed.
CREATE TABLE IF NOT EXISTS points_grant_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES points_grants(id) ON DELETE CASCADE,
  -- Nulled rather than deleted if the account goes: the grant still happened.
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  kick_id TEXT NOT NULL,
  username TEXT NOT NULL,
  points INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_grant_entries_grant
  ON points_grant_entries (grant_id);
CREATE INDEX IF NOT EXISTS idx_points_grant_entries_user
  ON points_grant_entries (user_id);

ALTER TABLE points_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_grant_entries ENABLE ROW LEVEL SECURITY;

-- --- what the overlay announces --------------------------------------------

-- Deliberately shaped like transaction_events: the OBS widget already knows
-- how to stream one of these in, show it for half a minute and drop it.
-- Aggregate numbers only, no usernames — see the read policy below.
CREATE TABLE IF NOT EXISTS points_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  points_each INTEGER NOT NULL,
  user_count INTEGER NOT NULL,
  total_points BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_events_created_at
  ON points_events (created_at DESC);

ALTER TABLE points_events ENABLE ROW LEVEL SECURITY;

-- Postgres has no CREATE POLICY IF NOT EXISTS, so drop first to keep this
-- script re-runnable.
DROP POLICY IF EXISTS "points_events are readable" ON points_events;

-- SELECT only, not FOR ALL. The OBS source reads this with the anon key and
-- never writes it — the grant route holds the service role, which bypasses RLS
-- anyway. An anon INSERT policy would let anyone fake a payout on stream.
CREATE POLICY "points_events are readable"
  ON points_events FOR SELECT USING (true);

-- --- the grant itself -------------------------------------------------------

-- Everything in one statement so a grant cannot half-happen: balances, ledger
-- and the announcement either all land or none do.
--
-- SECURITY DEFINER because the tables above have RLS with no policy; the
-- function is the only way in, and it is only reachable through a route that
-- has already checked for an admin session.
CREATE OR REPLACE FUNCTION grant_points_to_active_chatters(
  p_window_minutes INTEGER,
  p_points_each INTEGER,
  p_granted_by TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
-- The output columns are deliberately not named after any column in the tables
-- below: in plpgsql a RETURNS TABLE name is also a variable, and one that
-- collides with a column makes every unqualified mention ambiguous.
RETURNS TABLE (
  granted_id UUID,
  granted_users INTEGER,
  granted_total BIGINT,
  was_reused BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_grant_id UUID;
  v_count INTEGER;
  v_cutoff TIMESTAMPTZ;
  v_existing points_grants%ROWTYPE;
BEGIN
  IF p_window_minutes IS NULL OR p_window_minutes < 1 OR p_window_minutes > 1440 THEN
    RAISE EXCEPTION 'window_minutes must be between 1 and 1440, got %', p_window_minutes;
  END IF;

  IF p_points_each IS NULL OR p_points_each < 1 THEN
    RAISE EXCEPTION 'points_each must be at least 1, got %', p_points_each;
  END IF;

  -- Replaying a key returns the original grant untouched rather than granting
  -- again. This is what makes the button safe to press twice.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM points_grants g
     WHERE g.idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN QUERY SELECT v_existing.id, v_existing.user_count, v_existing.total_points, TRUE;
      RETURN;
    END IF;
  END IF;

  v_cutoff := NOW() - make_interval(mins => p_window_minutes);

  INSERT INTO points_grants (window_minutes, points_each, granted_by, idempotency_key)
  VALUES (p_window_minutes, p_points_each, p_granted_by, p_idempotency_key)
  RETURNING id INTO v_grant_id;

  -- The balance is bumped with an increment, never by writing back a number the
  -- caller read earlier: two grants landing together must add up, not overwrite
  -- each other. The "before" value comes from the statement's own snapshot.
  WITH active AS (
    SELECT ca.kick_id
      FROM chat_activity ca
     WHERE ca.last_message_at >= v_cutoff
  ),
  matched AS (
    SELECT u.id AS user_id,
           u.kick_id,
           u.username,
           -- Cast because no migration ever created users, so points_balance
           -- may be NUMERIC rather than INTEGER depending on how it was made.
           COALESCE(u.points_balance, 0)::INTEGER AS balance_before
      FROM users u
      JOIN active a ON a.kick_id = u.kick_id
  ),
  bumped AS (
    UPDATE users u
       SET points_balance = COALESCE(u.points_balance, 0) + p_points_each,
           last_rewarded = NOW()
      FROM matched m
     WHERE u.id = m.user_id
    RETURNING u.id AS user_id,
              m.kick_id,
              u.username,
              m.balance_before,
              u.points_balance::INTEGER AS balance_after
  )
  INSERT INTO points_grant_entries (
    grant_id, user_id, kick_id, username, points, balance_before, balance_after
  )
  SELECT v_grant_id, user_id, kick_id, username, p_points_each, balance_before, balance_after
    FROM bumped;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE points_grants
     SET user_count = v_count,
         total_points = v_count::BIGINT * p_points_each
   WHERE id = v_grant_id;

  -- Nobody was in the window. Recording an empty grant keeps the history
  -- honest, but announcing "0 points to 0 users" on stream is noise.
  IF v_count > 0 THEN
    INSERT INTO points_events (points_each, user_count, total_points)
    VALUES (p_points_each, v_count, v_count::BIGINT * p_points_each);
  END IF;

  RETURN QUERY SELECT v_grant_id, v_count, v_count::BIGINT * p_points_each, FALSE;
END;
$fn$;

-- Supabase exposes every function in the public schema as an RPC endpoint, and
-- this one is SECURITY DEFINER. Left at the default grants, anyone holding the
-- public anon key could call it and hand themselves points. Only the service
-- role — which nothing in the browser ever has — may execute it.
REVOKE ALL ON FUNCTION grant_points_to_active_chatters(INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION grant_points_to_active_chatters(INTEGER, INTEGER, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION grant_points_to_active_chatters(INTEGER, INTEGER, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION grant_points_to_active_chatters(INTEGER, INTEGER, TEXT, TEXT) TO service_role;

-- --- realtime ---------------------------------------------------------------

-- Without this the widget's subscription connects and never fires. Cost us a
-- debugging session once already (037).
DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'points_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE points_events;
  END IF;
END
$pub$;

-- --- panel defaults ---------------------------------------------------------

INSERT INTO settings (key, value)
VALUES
  ('points_active_window_minutes', '10'),
  ('points_default_amount', '100')
ON CONFLICT (key) DO NOTHING;

-- --- verify -----------------------------------------------------------------

SELECT
  (SELECT count(*) FROM chat_activity)                                        AS chatters_tracked,
  (SELECT count(*) FROM points_grants)                                        AS grants,
  (SELECT count(*) FROM points_events)                                        AS announcements,
  (SELECT count(*) FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'points_events')                                        AS in_realtime_publication,
  (SELECT count(*) FROM pg_proc
    WHERE proname = 'grant_points_to_active_chatters')                        AS grant_function;
