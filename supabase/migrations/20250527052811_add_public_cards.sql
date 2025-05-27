/*
  # Add public cards functionality

  1. Changes
    - Add is_public column to cards table
    - Add index for public cards queries
    - Update RLS policies to allow reading public cards

  2. Security
    - Allow authenticated users to read public cards from any user
    - Maintain existing policies for personal cards
*/

-- Add is_public column to cards table
ALTER TABLE cards
ADD COLUMN is_public boolean DEFAULT false NOT NULL;

-- Create index for public cards queries
CREATE INDEX idx_cards_is_public ON cards(is_public) WHERE is_public = true;

-- Update existing cards to be private by default
UPDATE cards SET is_public = false WHERE is_public IS NULL;

-- Add policy to allow users to read public cards from any user
CREATE POLICY "Users can read public cards"
  ON cards
  FOR SELECT
  TO authenticated
  USING (is_public = true);

-- Add policy to allow users to update their own cards' public status
CREATE POLICY "Users can update their own cards"
  ON cards
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
