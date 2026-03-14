/*
  # Create cards table

  1. New Tables
    - `cards`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `description` (text, not null)
      - `type` (text, not null)
      - `role` (text, not null)
      - `context` (text, not null)
      - `image_url` (text, not null)
      - `created_at` (timestamp with time zone, default: now())
      - `user_id` (uuid, foreign key to auth.users)

  2. Security
    - Enable RLS on `cards` table
    - Add policies for authenticated users to:
      - Create their own cards
      - Read their own cards
*/

CREATE TABLE IF NOT EXISTS cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  type text NOT NULL,
  role text NOT NULL,
  context text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to create their own cards
CREATE POLICY "Users can create their own cards"
  ON cards
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to read their own cards
CREATE POLICY "Users can read their own cards"
  ON cards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);