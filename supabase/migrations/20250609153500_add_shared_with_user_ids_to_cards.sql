/*
  # Add shared_with_user_ids to cards table and update RLS policies
  
  1. Changes
    - Add shared_with_user_ids array field to cards table
    - Create new RLS policy for shared cards
    - Ensure proper access control for cards shared via spreads
    
  2. Security
    - Allow targeted sharing without making cards fully public
    - Prevent unnecessary exposure of private cards
*/

-- Add shared_with_user_ids column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'cards' 
        AND column_name = 'shared_with_user_ids'
    ) THEN
        ALTER TABLE cards ADD COLUMN shared_with_user_ids UUID[] DEFAULT ARRAY[]::UUID[];
    END IF;
END $$;

-- Create index for better performance when querying by shared_with_user_ids
CREATE INDEX IF NOT EXISTS idx_cards_shared_with_user_ids ON cards USING GIN (shared_with_user_ids);

-- Add a new RLS policy for shared cards
DO $$
BEGIN
    -- Drop the policy if it exists to avoid conflicts
    DROP POLICY IF EXISTS "Users can view cards shared with them" ON cards;
    
    -- Create the new policy
    CREATE POLICY "Users can view cards shared with them"
      ON cards
      FOR SELECT
      TO authenticated
      USING (auth.uid() = ANY(shared_with_user_ids));
END;
$$;
