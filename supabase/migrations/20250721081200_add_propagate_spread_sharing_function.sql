-- Create the propagate_spread_sharing function that is referenced by the trigger
CREATE OR REPLACE FUNCTION propagate_spread_sharing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a spread's sharing settings are updated, propagate the changes to all cards in that spread
  IF NEW.shared_with_user_ids IS DISTINCT FROM OLD.shared_with_user_ids 
     OR NEW.share_with_specific_friends IS DISTINCT FROM OLD.share_with_specific_friends THEN
    
    -- Update all cards that belong to this spread
    UPDATE cards
    SET 
      shared_with_user_ids = NEW.shared_with_user_ids,
      share_with_specific_friends = NEW.share_with_specific_friends
    WHERE spread_id = NEW.id;
    
    -- Log the update for debugging
    RAISE NOTICE 'Updated % cards for spread % with sharing settings', 
                 (SELECT COUNT(*) FROM cards WHERE spread_id = NEW.id), 
                 NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists (it should already exist based on the schema)
DROP TRIGGER IF EXISTS trg_propagate_spread_sharing ON spreads;

CREATE TRIGGER trg_propagate_spread_sharing
AFTER UPDATE OF shared_with_user_ids, share_with_specific_friends ON spreads
FOR EACH ROW 
WHEN (
  NEW.shared_with_user_ids IS DISTINCT FROM OLD.shared_with_user_ids
  OR NEW.share_with_specific_friends IS DISTINCT FROM OLD.share_with_specific_friends
)
EXECUTE FUNCTION propagate_spread_sharing();
