-- What a raffle actually hands over.
--
-- prize_value was just a number, so nothing could tell "$100" from "100
-- points" — and the draw needs to know: points go straight onto the winner's
-- balance, cash goes on the winner log to be paid out by hand.
--
-- 'cash' is the default because that is what prize_value has meant so far, and
-- guessing 'points' for existing raffles would credit balances that were never
-- meant to move.
--
-- Safe to run more than once.

ALTER TABLE raffles
  ADD COLUMN IF NOT EXISTS prize_type TEXT NOT NULL DEFAULT 'cash';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'raffles_prize_type_check'
  ) THEN
    ALTER TABLE raffles
      ADD CONSTRAINT raffles_prize_type_check CHECK (prize_type IN ('cash', 'points', 'item'));
  END IF;
END $$;

-- --- verify ------------------------------------------------------------------
SELECT prize_type, count(*) FROM raffles GROUP BY prize_type ORDER BY prize_type;
