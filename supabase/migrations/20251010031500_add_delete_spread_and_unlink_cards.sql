-- Create a helper function to safely delete a spread after unlinking all cards
-- This avoids foreign key violations on cards.spread_id

-- Allow re-deployments
DROP FUNCTION IF EXISTS delete_spread_and_unlink_cards(uuid);

CREATE OR REPLACE FUNCTION delete_spread_and_unlink_cards(target_spread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  spread_owner uuid;
BEGIN
  -- Verify spread exists and get owner
  SELECT user_id INTO spread_owner FROM spreads WHERE id = target_spread_id;
  IF spread_owner IS NULL THEN
    RAISE EXCEPTION 'Spread not found';
  END IF;

  -- Only the spread owner can delete
  IF spread_owner != auth.uid() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- 1) Unlink all cards from this spread
  UPDATE cards
    SET spread_id = NULL
  WHERE spread_id = target_spread_id;

  -- 2) Delete the spread
  DELETE FROM spreads
  WHERE id = target_spread_id
    AND user_id = spread_owner;
END;
$$;

-- Optional: restrict who can call this function (keep consistent with your setup)
-- REVOKE ALL ON FUNCTION delete_spread_and_unlink_cards(uuid) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION delete_spread_and_unlink_cards(uuid) TO authenticated;
