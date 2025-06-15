-- Function to get a spread with its cards
CREATE OR REPLACE FUNCTION public.get_spread_with_cards(
  spread_id uuid,
  user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Check if user has access to this spread
  IF NOT EXISTS (
    SELECT 1 
    FROM spreads 
    WHERE id = spread_id 
    AND (user_id = get_spread_with_cards.user_id 
         OR shared_with_user_ids @> ARRAY[get_spread_with_cards.user_id]::uuid[])
  ) THEN
    RAISE EXCEPTION 'You do not have permission to access this spread';
  END IF;
  
  -- Get the spread with its cards
  SELECT jsonb_build_object(
    'spread', to_jsonb(s.*),
    'cards', (
      SELECT jsonb_agg(c.*)
      FROM cards c
      WHERE c.spread_id = spread_id
      AND (c.user_id = get_spread_with_cards.user_id 
           OR c.shared_with_user_ids @> ARRAY[get_spread_with_cards.user_id]::uuid[])
    )
  )
  INTO result
  FROM spreads s
  WHERE s.id = spread_id;
  
  RETURN result;
END;
$$;

-- Function to share a spread with multiple users atomically
CREATE OR REPLACE FUNCTION public.share_spread_with_users(
  p_spread_id uuid,
  p_recipient_ids uuid[],
  p_sharer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_spread_owner_id uuid;
  v_shared_with_user_ids uuid[];
  v_card_ids uuid[];
  v_result jsonb;
  v_error_message text;
  v_error_detail text;
  v_error_hint text;
  v_error_context text;
  v_card_count int;
  v_updated_cards int := 0;
  v_skipped_cards int := 0;
BEGIN
  -- Start transaction
  BEGIN
    -- 1. Verify the spread exists and user has permission to share it
    SELECT user_id, shared_with_user_ids
    INTO v_spread_owner_id, v_shared_with_user_ids
    FROM spreads
    WHERE id = p_spread_id
    FOR UPDATE; -- Lock the row
    
    IF v_spread_owner_id IS NULL THEN
      RAISE EXCEPTION 'Spread not found';
    END IF;
    
    IF v_spread_owner_id != p_sharer_id THEN
      RAISE EXCEPTION 'Only the spread owner can share it';
    END IF;
    
    -- 2. Update the spread's shared_with_user_ids
    -- Merge existing shared_with_user_ids with new ones, removing duplicates
    v_shared_with_user_ids := (
      SELECT array_agg(DISTINCT unnest(
        COALESCE(v_shared_with_user_ids, '{}'::uuid[]) || p_recipient_ids
      ))
    );
    
    UPDATE spreads
    SET 
      shared_with_user_ids = v_shared_with_user_ids,
      share_with_specific_friends = true,
      updated_at = NOW()
    WHERE id = p_spread_id;
    
    -- 3. Get all cards in the spread that belong to the sharer
    SELECT array_agg(id), COUNT(*)
    INTO v_card_ids, v_card_count
    FROM cards
    WHERE spread_id = p_spread_id
    AND user_id = p_sharer_id;
    
    -- 4. Update sharing for each card
    IF v_card_count > 0 THEN
      -- Update all cards in a single operation for better performance
      WITH updated AS (
        UPDATE cards
        SET 
          shared_with_user_ids = (
            SELECT array_agg(DISTINCT unnest(
              COALESCE(cards.shared_with_user_ids, '{}'::uuid[]) || p_recipient_ids
            ))
          ),
          share_with_specific_friends = true,
          updated_at = NOW()
        WHERE id = ANY(v_card_ids)
        AND user_id = p_sharer_id
        RETURNING 1
      )
      SELECT COUNT(*) INTO v_updated_cards FROM updated;
      
      v_skipped_cards := v_card_count - v_updated_cards;
    END IF;
    
    -- 5. Return success with statistics
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Spread shared successfully',
      'shared_with_user_ids', v_shared_with_user_ids,
      'cards_updated', v_updated_cards,
      'cards_skipped', v_skipped_cards,
      'total_cards_in_spread', v_card_count
    );
    
    -- Commit the transaction
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Get error details
    GET STACKED DIAGNOSTICS 
      v_error_message = MESSAGE_TEXT,
      v_error_detail = PG_EXCEPTION_DETAIL,
      v_error_hint = PG_EXCEPTION_HINT,
      v_error_context = PG_EXCEPTION_CONTEXT;
    
    -- Rollback the transaction
    RAISE EXCEPTION 
      'Error sharing spread: % % % %',
      SQLSTATE, 
      v_error_message, 
      COALESCE(v_error_detail, ''), 
      COALESCE(v_error_hint, '');
  END;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_spread_with_cards(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_spread_with_users(uuid, uuid[], uuid) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_spread_with_cards(uuid, uuid) IS 
'Retrieves a spread and its associated cards that the requesting user has access to.';

COMMENT ON FUNCTION public.share_spread_with_users(uuid, uuid[], uuid) IS 
'Shares a spread and its cards with the specified users atomically. 
Only the spread owner can share it. Returns statistics about the operation.';
