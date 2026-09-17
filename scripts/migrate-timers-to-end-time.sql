-- Convert obs_timers table from duration-based to end_time-based system
-- Drop existing duration column and add end_time as timestamptz

-- First, add the new end_time column
ALTER TABLE obs_timers ADD COLUMN end_time TIMESTAMPTZ;

-- For any existing timers with duration, convert them to end_time
-- If timer is started, calculate end_time from now + duration
-- If not started, set end_time to 1 hour from now as a default
UPDATE obs_timers
SET end_time = CASE 
  WHEN started = true THEN now() + (duration || ' seconds')::interval
  ELSE now() + interval '1 hour'
END
WHERE end_time IS NULL;

-- Drop the old columns that are no longer needed
ALTER TABLE obs_timers DROP COLUMN duration;
ALTER TABLE obs_timers DROP COLUMN started;

-- Make end_time NOT NULL after data migration
ALTER TABLE obs_timers ALTER COLUMN end_time SET NOT NULL;
