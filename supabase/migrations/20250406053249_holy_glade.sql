/*
  # Update Collection Visibility Schema

  1. Changes
    - Add visibility array column to collections table
    - Drop existing policies that depend on type column
    - Drop type column
    - Add new policies for visibility array

  2. Security
    - Update RLS policies to work with new visibility array
    - Maintain data access control based on visibility settings
*/

-- First, drop dependent policies
DROP POLICY IF EXISTS "Users can view public collections" ON collections;
DROP POLICY IF EXISTS "Users can view public cards" ON cards;
DROP POLICY IF EXISTS "Users can view shared cards" ON cards;

-- Now we can safely drop the type column and add the visibility array
ALTER TABLE collections 
DROP COLUMN type,
ADD COLUMN visibility text[] NOT NULL DEFAULT ARRAY['personal']::text[] 
CHECK (
  array_length(visibility, 1) BETWEEN 1 AND 3 AND
  visibility <@ ARRAY['personal', 'friends', 'public']::text[]
);

-- Create new policies for collections
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

-- Create new policy for cards
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