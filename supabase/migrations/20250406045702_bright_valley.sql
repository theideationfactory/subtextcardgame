/*
  # Add collection types and sharing capabilities
  
  1. New Tables
    - `collections` table to store different collection types
    - `shared_collections` table to manage collection sharing between users
    
  2. Changes
    - Add `collection_id` to `cards` table
    - Add foreign key constraints
    
  3. Security
    - Enable RLS on new tables
    - Add policies for collection access
*/

-- Create collections table
CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('personal', 'friends', 'public')),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on collections
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Create shared_collections table for friend sharing
CREATE TABLE IF NOT EXISTS shared_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
  shared_with_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(collection_id, shared_with_id)
);

-- Enable RLS on shared_collections
ALTER TABLE shared_collections ENABLE ROW LEVEL SECURITY;

-- Add collection_id to cards table
ALTER TABLE cards 
ADD COLUMN collection_id uuid REFERENCES collections(id);

-- Create indexes
CREATE INDEX idx_cards_collection_id ON cards(collection_id);
CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_shared_collections_shared_with ON shared_collections(shared_with_id);

-- Collection Policies
CREATE POLICY "Users can manage their own collections"
  ON collections
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view public collections"
  ON collections
  FOR SELECT
  TO authenticated
  USING (type = 'public');

-- Shared Collections Policies
CREATE POLICY "Users can view collections shared with them"
  ON shared_collections
  FOR SELECT
  TO authenticated
  USING (shared_with_id = auth.uid());

CREATE POLICY "Users can share their own collections"
  ON shared_collections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections 
      WHERE id = collection_id 
      AND user_id = auth.uid()
    )
  );

-- Update Cards Policies
CREATE POLICY "Users can view public cards"
  ON cards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections 
      WHERE id = collection_id 
      AND type = 'public'
    )
  );

CREATE POLICY "Users can view shared cards"
  ON cards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_collections 
      WHERE collection_id = cards.collection_id 
      AND shared_with_id = auth.uid()
    )
  );