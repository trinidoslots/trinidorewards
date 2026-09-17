-- Drop and recreate the draw_raffle_winner function with correct logic
DROP FUNCTION IF EXISTS draw_raffle_winner(UUID);

CREATE OR REPLACE FUNCTION draw_raffle_winner(raffle_id_param UUID)
RETURNS TABLE(
  winner_username TEXT,
  winner_ticket_number INTEGER,
  total_entries INTEGER
) AS $$
DECLARE
  random_ticket INTEGER;
  winner_user_id TEXT;
  winner_name TEXT;
  total_tickets INTEGER;
  cumulative_tickets INTEGER;
  entry_record RECORD;
BEGIN
  -- Get total tickets from all entries for this raffle
  SELECT COALESCE(SUM(tickets_purchased), 0) INTO total_tickets
  FROM raffle_entries
  WHERE raffle_id = raffle_id_param;

  -- If no tickets sold, return null
  IF total_tickets = 0 OR total_tickets IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::INTEGER, 0;
    RETURN;
  END IF;

  -- Generate random ticket number between 1 and total_tickets
  random_ticket := floor(random() * total_tickets + 1)::INTEGER;

  -- Find the entry that owns this ticket number
  -- We need to iterate through entries and find which range the random ticket falls into
  cumulative_tickets := 0;
  
  FOR entry_record IN 
    SELECT user_id, tickets_purchased 
    FROM raffle_entries 
    WHERE raffle_id = raffle_id_param
    ORDER BY created_at
  LOOP
    cumulative_tickets := cumulative_tickets + entry_record.tickets_purchased;
    
    IF random_ticket <= cumulative_tickets THEN
      winner_user_id := entry_record.user_id;
      EXIT;
    END IF;
  END LOOP;

  -- Get the winner's username from the users table
  SELECT username INTO winner_name
  FROM users
  WHERE id = winner_user_id;

  -- If no username found, use the user_id
  IF winner_name IS NULL THEN
    winner_name := winner_user_id;
  END IF;

  -- Update the raffle with winner information
  UPDATE raffles
  SET 
    winner_username = winner_name,
    winner_ticket_number = random_ticket,
    status = 'drawn',
    draw_date = NOW(),
    updated_at = NOW()
  WHERE id = raffle_id_param;

  -- Return winner information
  RETURN QUERY SELECT winner_name, random_ticket, total_tickets::INTEGER;
END;
$$ LANGUAGE plpgsql;
