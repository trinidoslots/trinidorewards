-- The OBS stream widget shows how long a giveaway has been running, which needs
-- the round's start time to survive a widget reload. The admin page already
-- tracked it, but only in local React state.
ALTER TABLE giveaway_state
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- Backfill any round that is already live so the badge isn't blank until the
-- next round starts. updated_at is the closest stand-in we have.
UPDATE giveaway_state
   SET started_at = updated_at
 WHERE started_at IS NULL
   AND status <> 'idle';
