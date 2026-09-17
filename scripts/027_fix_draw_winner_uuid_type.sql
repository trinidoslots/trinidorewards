-- Fix the draw_raffle_winner function to use UUID type instead of TEXT
-- Drop all versions of the function (TEXT and UUID)
DROP FUNCTION IF EXISTS draw_raffle_winner(TEXT);
DROP FUNCTION IF EXISTS draw_raffle_winner(UUID);

-- Updated function to use correct column names from raffles table schema
CREATE OR REPLACE FUNCTION draw_raffle_winner(raffle_id_param UUID)
RETURNS TABLE (
  winner_id UUID,
  winner_name TEXT,
  winning_ticket INTEGER
) AS $$
DECLARE
  total_tickets INTEGER;
  random_ticket INTEGER;
  current_sum INTEGER := 0;
  entry_record RECORD;
BEGIN
  -- Count total tickets for this raffle
  SELECT COALESCE(SUM(tickets_purchased), 0) INTO total_tickets
  FROM raffle_entries
  WHERE raffle_id = raffle_id_param;

  -- Check if there are any entries
  IF total_tickets = 0 THEN
    RAISE EXCEPTION 'No entries found for this raffle. Cannot draw a winner.';
  END IF;

  -- Generate random ticket number (1 to total_tickets)
  random_ticket := floor(random() * total_tickets)::INTEGER + 1;

  -- Find the winner by iterating through entries and their ticket ranges
  FOR entry_record IN
    SELECT re.user_id, re.tickets_purchased, u.username
    FROM raffle_entries re
    JOIN users u ON u.id = re.user_id
    WHERE re.raffle_id = raffle_id_param
    ORDER BY re.created_at
  LOOP
    current_sum := current_sum + entry_record.tickets_purchased;
    
    IF random_ticket <= current_sum THEN
      -- Found the winner
      winner_id := entry_record.user_id;
      winner_name := entry_record.username;
      winning_ticket := random_ticket;
      
      -- Update using correct column names: winner_username, winner_ticket_number, draw_date, status
      UPDATE raffles
      SET 
        winner_username = entry_record.username,
        winner_ticket_number = random_ticket,
        draw_date = NOW(),
        status = 'drawn'
      WHERE id = raffle_id_param;
      
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  -- Should never reach here, but just in case
  RAISE EXCEPTION 'Failed to determine winner';
END;
$$ LANGUAGE plpgsql;
