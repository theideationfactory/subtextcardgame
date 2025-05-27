-- Add visibility control columns to cards table
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS is_shared_with_friends boolean DEFAULT false NOT NULL;

-- Update existing cards to maintain current behavior
-- Set existing cards to be public by default for backward compatibility
UPDATE cards SET 
  is_public = true,
  is_shared_with_friends = true 
WHERE is_public IS NULL OR is_shared_with_friends IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cards_shared_friends ON cards(is_shared_with_friends) 
WHERE is_shared_with_friends = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to public cards" ON cards;
DROP POLICY IF EXISTS "Allow friends to see shared cards" ON cards;

-- Update RLS policies to respect the new visibility settings
CREATE POLICY "Allow public read access to public cards" ON cards
  FOR SELECT
  TO authenticated, anon
  USING (is_public = true);

-- Add policy for friends visibility
CREATE POLICY "Allow friends to see shared cards" ON cards
  FOR SELECT
  TO authenticated
  USING (
    is_shared_with_friends = true AND
    user_id IN (
      SELECT 
        CASE 
          WHEN sender_id = auth.uid() THEN receiver_id 
          ELSE sender_id 
        END as friend_id
      FROM friend_requests
      WHERE (sender_id = auth.uid() OR receiver_id = auth.uid())
      AND status = 'accepted'
    )
  );

-- Add policy for users to see their own cards
CREATE POLICY "Users can see their own cards" ON cards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
