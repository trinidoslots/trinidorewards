-- "Only on Stake": which catalogue slots are Stake exclusives.
--
-- Set by importing the file from the "Only on Stake" script on /admin/slots,
-- which reads https://stake.com/casino/group/only-on-stake. That list is taken
-- as complete: slots in it get the tag, slots that dropped out of it lose it.
--
-- The now-playing bar reads this too: a game on the bar with no badge of its
-- own gets "Only on Stake" from here (lib/slot-meta.ts).
--
-- Needs 077. Safe to re-run.

ALTER TABLE public.slots ADD COLUMN IF NOT EXISTS only_on_stake BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_slots_only_on_stake ON public.slots (only_on_stake) WHERE only_on_stake;

-- Exact-name lookups for the now-playing bar, case-insensitive.
CREATE INDEX IF NOT EXISTS idx_slots_lower_game_name ON public.slots (lower(game_name));

SELECT
  (SELECT count(*) FROM public.slots)                     AS slots,
  (SELECT count(*) FROM public.slots WHERE only_on_stake) AS only_on_stake;
