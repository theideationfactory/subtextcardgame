/*
  # Fix infinite recursion in cards RLS policies
  
  1. Changes
    - Drop all existing RLS policies on cards table
    - Create simplified, non-recursive policies
    - Ensure proper access control for cards
    
  2. Security
    - Maintain same security model but with optimized policies
    - Prevent infinite recursion errors
*/

-- Make sure RLS is enabled on the cards table
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on the cards table to start fresh
DO $$
BEGIN
    -- Drop all existing policies
    DROP POLICY IF EXISTS "Users can create their own cards" ON cards;
    DROP POLICY IF EXISTS "Users can read their own cards" ON cards;
    DROP POLICY IF EXISTS "Users can view public cards" ON cards;
    DROP POLICY IF EXISTS "Users can view shared cards" ON cards;
    DROP POLICY IF EXISTS "Users can update their own cards" ON cards;
    DROP POLICY IF EXISTS "Allow public read access to public cards" ON cards;
    DROP POLICY IF EXISTS "Allow friends to see shared cards" ON cards;
    DROP POLICY IF EXISTS "Users can see their own cards" ON cards;
    DROP POLICY IF EXISTS "Users can manage their own cards" ON cards;
    DROP POLICY IF EXISTS "Anyone can read public cards" ON cards;
    DROP POLICY IF EXISTS "Friends can see shared cards" ON cards;
    
    -- Create new policies
    
    -- 1. Basic policy for users to manage their own cards
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cards' AND policyname = 'Users can manage their own cards') THEN
        CREATE POLICY "Users can manage their own cards"
          ON cards
          FOR ALL
          TO authenticated
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
    
    -- 2. Allow reading public cards
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cards' AND policyname = 'Anyone can read public cards') THEN
        CREATE POLICY "Anyone can read public cards"
          ON cards
          FOR SELECT
          TO authenticated, anon
          USING (is_public = true);
    END IF;
    
    -- 3. Create a simplified policy for friends to see shared cards
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cards' AND policyname = 'Friends can see shared cards') THEN
        CREATE POLICY "Friends can see shared cards"
          ON cards
          FOR SELECT
          TO authenticated
          USING (
            is_shared_with_friends = true AND
            EXISTS (
              SELECT 1
              FROM friend_requests
              WHERE status = 'accepted'
              AND (
                (sender_id = auth.uid() AND receiver_id = cards.user_id) OR
                (receiver_id = auth.uid() AND sender_id = cards.user_id)
              )
            )
          );
    END IF;
END;
$$;
