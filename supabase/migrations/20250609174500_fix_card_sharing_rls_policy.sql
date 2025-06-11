/*
  # Fix card sharing RLS policies to allow update of share_with_specific_friends and shared_with_user_ids
  
  1. Changes
    - Creates a clear UPDATE policy for cards to allow proper sharing
    - Modifies the SELECT policy to check for share_with_specific_friends
    - Ensures users can update card sharing fields for cards they own
    
  2. Security
    - Maintains the same security model but fixes permission issues
    - Allows card owners to update sharing settings properly
*/

-- First, make sure the existing SELECT policy correctly checks for share_with_specific_friends
DROP POLICY IF EXISTS "Users can view cards shared with them" ON cards;
    
CREATE POLICY "Users can view cards shared with them"
  ON cards
  FOR SELECT
  TO authenticated
  USING (
    share_with_specific_friends = true AND
    auth.uid() = ANY(shared_with_user_ids)
  );

-- Ensure there's a proper UPDATE policy that allows users to update sharing settings on their own cards
DROP POLICY IF EXISTS "Users can update sharing on their cards" ON cards;

CREATE POLICY "Users can update sharing on their cards"
  ON cards
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Verify existing policies haven't been changed
DO $$
BEGIN
    -- Verify the basic policy for users to manage their own cards still exists
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cards' AND policyname = 'Users can manage their own cards') THEN
        CREATE POLICY "Users can manage their own cards"
          ON cards
          FOR ALL
          TO authenticated
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END;
$$;
