/*
  # Create users and spreads tables

  1. New Tables
    - `users` (if not exists)
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `created_at` (timestamp)
    
    - `spreads`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `description` (text)
      - `color` (text, not null)
      - `icon` (text, not null)
      - `user_id` (uuid, foreign key to users)
      - `created_at` (timestamp with time zone)
      - `zones` (jsonb, not null)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their spreads
*/

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create spreads table
CREATE TABLE IF NOT EXISTS spreads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text NOT NULL,
  icon text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  zones jsonb NOT NULL
);

-- Enable RLS on spreads table
ALTER TABLE spreads ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own spreads
CREATE POLICY "Users can read own spreads"
  ON spreads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to create their own spreads
CREATE POLICY "Users can create spreads"
  ON spreads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own spreads
CREATE POLICY "Users can update own spreads"
  ON spreads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own spreads
CREATE POLICY "Users can delete own spreads"
  ON spreads
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add policy for users to read their own data
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);