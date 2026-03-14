-- Add spread_id column to cards table
ALTER TABLE cards
ADD COLUMN spread_id UUID REFERENCES spreads(id);

-- Create an index on spread_id for better query performance
CREATE INDEX idx_cards_spread_id ON cards(spread_id);

-- Update the RLS policy for cards to allow viewing based on spread permissions
DROP POLICY IF EXISTS "Users can view cards shared with them" ON cards;

CREATE POLICY "Users can view cards shared with specific users or via spread" ON cards
FOR SELECT
USING (
  -- User owns the card
  (auth.uid() = user_id) OR
  
  -- Card is public
  (is_public = true) OR
  
  -- Card is explicitly shared with this user
  (share_with_specific_friends = true AND auth.uid() = ANY(shared_with_user_ids)) OR
  
  -- Card belongs to a spread that is shared with this user
  (
    spread_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM spreads
      WHERE spreads.id = cards.spread_id
      AND (
        -- Spread is shared with specific users and this user is one of them
        (spreads.share_with_specific_friends = true AND auth.uid() = ANY(spreads.shared_with_user_ids))
      )
    )
  )
);

-- Ensure cards can be updated by owners
DROP POLICY IF EXISTS "Allow users to update share_with_specific_friends" ON cards;

CREATE POLICY "Users can update their cards" ON cards
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
