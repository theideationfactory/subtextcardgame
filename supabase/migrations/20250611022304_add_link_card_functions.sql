CREATE OR REPLACE FUNCTION link_card_to_spread(card_id_to_link uuid, target_spread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  spread_owner_id uuid;
BEGIN
  -- 1. Get the owner of the target spread
  SELECT user_id INTO spread_owner_id FROM spreads WHERE id = target_spread_id;

  -- 2. Check if the current user owns the spread
  IF spread_owner_id IS NULL OR spread_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'User does not have permission to add cards to this spread';
  END IF;

  -- 3. Check if the user can view the card (owns it, it's public, or shared with them)
  -- This prevents users from linking cards they shouldn't know about.
  -- We rely on the existing SELECT RLS policy for this check.
  IF NOT EXISTS (SELECT 1 FROM cards WHERE id = card_id_to_link) THEN
      RAISE EXCEPTION 'Card not found or user does not have permission to view it';
  END IF;

  -- 4. If all checks pass, perform the update.
  -- RLS is bypassed here because the function is SECURITY DEFINER.
  UPDATE cards
  SET spread_id = target_spread_id
  WHERE id = card_id_to_link;
END;
$$;

CREATE OR REPLACE FUNCTION unlink_card_from_spread(card_id_to_unlink uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  card_owner_id uuid;
  spread_owner_id uuid;
  current_spread_id uuid;
BEGIN
  -- 1. Get the card's current spread_id and owner
  SELECT spread_id, user_id INTO current_spread_id, card_owner_id FROM cards WHERE id = card_id_to_unlink;

  -- If the card is not in a spread, there's nothing to do.
  IF current_spread_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Get the owner of the spread the card is currently in
  SELECT user_id INTO spread_owner_id FROM spreads WHERE id = current_spread_id;

  -- 3. The user must be either the owner of the card OR the owner of the spread to unlink it.
  IF auth.uid() != card_owner_id AND auth.uid() != spread_owner_id THEN
    RAISE EXCEPTION 'User does not have permission to remove this card from the spread';
  END IF;

  -- 4. If checks pass, perform the update.
  UPDATE cards
  SET spread_id = NULL
  WHERE id = card_id_to_unlink;
END;
$$;
