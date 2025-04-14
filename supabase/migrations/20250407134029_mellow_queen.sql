/*
  # Update Collection Visibility Schema and Policies

  1. Changes
    - Safely handle existing policies
    - Add visibility array column if it doesn't exist
    - Update policies for collections and cards

  2. Security
    - Maintain data access control based on visibility settings
    - Ensure proper policy creation/updates
*/

-- First, drop dependent policies if they exist
DROP POLICY IF EXISTS "Users can view public collections" ON collections;
DROP POLICY IF EXISTS "Users can view public cards" ON cards;
DROP POLICY IF EXISTS "Users can view shared cards" ON cards;

-- Add visibility array if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'collections' 
    AND column_name = 'visibility'
  ) THEN
    ALTER TABLE collections 
    ADD COLUMN visibility text[] NOT NULL DEFAULT ARRAY['personal']::text[] 
    CHECK (
      array_length(visibility, 1) BETWEEN 1 AND 3 AND
      visibility <@ ARRAY['personal', 'friends', 'public']::text[]
    );
  END IF;
END $$;

-- Safely recreate collections policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view visible collections" ON collections;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collections' 
    AND policyname = 'Users can view visible collections'
  ) THEN
    CREATE POLICY "Users can view visible collections"
      ON collections
      FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid() OR
        'public' = ANY(visibility) OR
        (
          'friends' = ANY(visibility) AND
          EXISTS (
            SELECT 1 FROM friend_requests
            WHERE (
              (sender_id = auth.uid() AND receiver_id = collections.user_id) OR
              (receiver_id = auth.uid() AND sender_id = collections.user_id)
            )
            AND status = 'accepted'
          )
        )
      );
  END IF;
END $$;

-- Safely recreate cards policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view visible cards" ON cards;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cards' 
    AND policyname = 'Users can view visible cards'
  ) THEN
    CREATE POLICY "Users can view visible cards"
      ON cards
      FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM collections 
          WHERE id = collection_id AND (
            'public' = ANY(visibility) OR
            (
              'friends' = ANY(visibility) AND
              EXISTS (
                SELECT 1 FROM friend_requests
                WHERE (
                  (sender_id = auth.uid() AND receiver_id = collections.user_id) OR
                  (receiver_id = auth.uid() AND sender_id = collections.user_id)
                )
                AND status = 'accepted'
              )
            )
          )
        )
      );
  END IF;
END $$;