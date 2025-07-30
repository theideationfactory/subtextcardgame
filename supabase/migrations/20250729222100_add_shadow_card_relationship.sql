/*
  # Add shadow card relationship

  1. Changes
    - Add `shadow_card_id` column to cards table
    - This allows cards to have a custom "shadow" or "back" card
    - Self-referencing foreign key to cards table
    - Nullable - not all cards need a shadow

  2. Security
    - Update existing policies to handle shadow card relationships
    - Users can only link their own cards as shadows
*/

-- Add shadow_card_id column to cards table
ALTER TABLE cards 
ADD COLUMN shadow_card_id uuid REFERENCES cards(id);

-- Add index for better performance when querying shadow cards
CREATE INDEX idx_cards_shadow_card_id ON cards(shadow_card_id);

-- Update the insert policy to allow shadow card relationships
DROP POLICY IF EXISTS "Users can create their own cards" ON cards;
CREATE POLICY "Users can create their own cards"
  ON cards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    (shadow_card_id IS NULL OR 
     EXISTS (
       SELECT 1 FROM cards shadow_card 
       WHERE shadow_card.id = shadow_card_id 
       AND shadow_card.user_id = auth.uid()
     ))
  );

-- Update the select policy to include shadow card data
DROP POLICY IF EXISTS "Users can read their own cards" ON cards;
CREATE POLICY "Users can read their own cards"
  ON cards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add policy to allow users to update shadow card relationships on their own cards
CREATE POLICY "Users can update their own cards"
  ON cards
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    (shadow_card_id IS NULL OR 
     EXISTS (
       SELECT 1 FROM cards shadow_card 
       WHERE shadow_card.id = shadow_card_id 
       AND shadow_card.user_id = auth.uid()
     ))
  );
