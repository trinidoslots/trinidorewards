-- Add function to automatically update raffle status based on dates
CREATE OR REPLACE FUNCTION update_raffle_status()
RETURNS void AS $$
BEGIN
  -- Update upcoming raffles to active when start_date is reached
  UPDATE raffles
  SET status = 'active', updated_at = NOW()
  WHERE status = 'upcoming'
    AND start_date <= NOW();

  -- Update active raffles to ended when end_date is reached
  UPDATE raffles
  SET status = 'ended', updated_at = NOW()
  WHERE status = 'active'
    AND end_date <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Add function to draw a random winner from raffle entries
CREATE OR REPLACE FUNCTION draw_raffle_winner(raffle_id_param UUID)
RETURNS TABLE(
  winner_username TEXT,
  winner_ticket_number INTEGER,
  total_entries INTEGER
) AS $$
DECLARE
  random_ticket INTEGER;
  winner_entry RECORD;
  total_tickets INTEGER;
BEGIN
  -- Get total tickets sold for this raffle
  SELECT tickets_sold INTO total_tickets
  FROM raffles
  WHERE id = raffle_id_param;

  -- If no tickets sold, return null
  IF total_tickets = 0 THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::INTEGER, 0;
    RETURN;
  END IF;

  -- Generate random ticket number between 1 and total_tickets
  random_ticket := floor(random() * total_tickets + 1)::INTEGER;

  -- Find the entry that owns this ticket number
  SELECT username, ticket_numbers INTO winner_entry
  FROM raffle_entries
  WHERE raffle_id_param = ANY(ticket_numbers)
    AND raffle_id = raffle_id_param
  LIMIT 1;

  -- Update the raffle with winner information
  UPDATE raffles
  SET 
    winner_username = winner_entry.username,
    winner_ticket_number = random_ticket,
    status = 'drawn',
    draw_date = NOW(),
    updated_at = NOW()
  WHERE id = raffle_id_param;

  -- Return winner information
  RETURN QUERY SELECT winner_entry.username, random_ticket, total_tickets;
END;
$$ LANGUAGE plpgsql;
