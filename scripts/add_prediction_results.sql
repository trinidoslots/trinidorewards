-- Add actual hunt results columns to prediction_settings table
ALTER TABLE prediction_settings 
ADD COLUMN IF NOT EXISTS actual_highest_multi NUMERIC,
ADD COLUMN IF NOT EXISTS actual_final_balance NUMERIC,
ADD COLUMN IF NOT EXISTS actual_best_game TEXT,
ADD COLUMN IF NOT EXISTS results_entered_at TIMESTAMP WITH TIME ZONE;

-- Create a helper function to find the closest prediction
CREATE OR REPLACE FUNCTION find_closest_prediction(
  hunt_id_param TEXT,
  category TEXT,
  target_value NUMERIC DEFAULT NULL,
  target_game TEXT DEFAULT NULL
)
RETURNS TABLE (
  pred_id UUID,
  username TEXT,
  predicted_value NUMERIC,
  game_value TEXT,
  difference NUMERIC
) AS $$
BEGIN
  IF category = 'highest_multi' THEN
    RETURN QUERY
    SELECT 
      hp.id,
      hp.username,
      hp.predicted_max_multiplier,
      NULL::TEXT,
      ABS(hp.predicted_max_multiplier - target_value)
    FROM hunt_predictions hp
    WHERE hp.hunt_id = hunt_id_param
    AND hp.predicted_max_multiplier IS NOT NULL
    ORDER BY ABS(hp.predicted_max_multiplier - target_value) ASC
    LIMIT 1;
  ELSIF category = 'final_balance' THEN
    RETURN QUERY
    SELECT 
      hp.id,
      hp.username,
      hp.predicted_end_balance,
      NULL::TEXT,
      ABS(hp.predicted_end_balance - target_value)
    FROM hunt_predictions hp
    WHERE hp.hunt_id = hunt_id_param
    AND hp.predicted_end_balance IS NOT NULL
    ORDER BY ABS(hp.predicted_end_balance - target_value) ASC
    LIMIT 1;
  ELSIF category = 'best_game' THEN
    RETURN QUERY
    SELECT 
      hp.id,
      hp.username,
      NULL::NUMERIC,
      hp.predicted_best_game,
      0::NUMERIC
    FROM hunt_predictions hp
    WHERE hp.hunt_id = hunt_id_param
    AND hp.predicted_best_game = target_game;
  END IF;
END;
$$ LANGUAGE plpgsql;
