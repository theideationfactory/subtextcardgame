/*
  # Add user search functionality

  1. New Functions
    - `search_users`: Function to search users by email
    - `get_friend_requests`: Function to get pending friend requests
    - `get_friends`: Function to get user's friends

  2. New Tables
    - `friend_requests`
      - `id` (uuid, primary key)
      - `sender_id` (uuid, references auth.users)
      - `receiver_id` (uuid, references auth.users)
      - `status` (text, enum: pending, accepted, rejected)
      - `created_at` (timestamp)

  3. Security
    - Enable RLS on friend_requests table
    - Add policies for managing friend requests
*/

-- Create friend request status enum
CREATE TYPE friend_request_status AS ENUM ('pending', 'accepted', 'rejected');

-- Create friend_requests table
CREATE TABLE IF NOT EXISTS friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) NOT NULL,
  receiver_id uuid REFERENCES auth.users(id) NOT NULL,
  status friend_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Enable RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);

-- Create function to search users
CREATE OR REPLACE FUNCTION search_users(search_query text, current_user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  friendship_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.created_at,
    CASE
      WHEN fr.status = 'accepted' THEN 'friend'
      WHEN fr.status = 'pending' AND fr.sender_id = current_user_id THEN 'request_sent'
      WHEN fr.status = 'pending' AND fr.receiver_id = current_user_id THEN 'request_received'
      ELSE 'none'
    END as friendship_status
  FROM users u
  LEFT JOIN friend_requests fr ON 
    (fr.sender_id = current_user_id AND fr.receiver_id = u.id) OR
    (fr.receiver_id = current_user_id AND fr.sender_id = u.id)
  WHERE 
    u.id != current_user_id AND
    u.email ILIKE '%' || search_query || '%'
  ORDER BY 
    u.email;
END;
$$;

-- Create function to get friend requests
CREATE OR REPLACE FUNCTION get_friend_requests(user_id uuid)
RETURNS TABLE (
  request_id uuid,
  sender_id uuid,
  sender_email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fr.id as request_id,
    fr.sender_id,
    u.email as sender_email,
    fr.created_at
  FROM friend_requests fr
  JOIN users u ON fr.sender_id = u.id
  WHERE 
    fr.receiver_id = user_id AND
    fr.status = 'pending'
  ORDER BY fr.created_at DESC;
END;
$$;

-- Create function to get friends
CREATE OR REPLACE FUNCTION get_friends(user_id uuid)
RETURNS TABLE (
  friend_id uuid,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE
      WHEN fr.sender_id = user_id THEN u.id
      ELSE fr.sender_id
    END as friend_id,
    u.email,
    fr.created_at
  FROM friend_requests fr
  JOIN users u ON 
    CASE
      WHEN fr.sender_id = user_id THEN fr.receiver_id = u.id
      ELSE fr.sender_id = u.id
    END
  WHERE 
    (fr.sender_id = user_id OR fr.receiver_id = user_id) AND
    fr.status = 'accepted'
  ORDER BY fr.created_at DESC;
END;
$$;

-- RLS Policies for friend_requests

-- Users can view their own requests (sent or received)
CREATE POLICY "Users can view their own requests"
  ON friend_requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id
  );

-- Users can send friend requests
CREATE POLICY "Users can send friend requests"
  ON friend_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    sender_id != receiver_id
  );

-- Users can update requests they're involved in
CREATE POLICY "Users can update their requests"
  ON friend_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = receiver_id AND
    status = 'pending'
  )
  WITH CHECK (
    auth.uid() = receiver_id AND
    status IN ('accepted', 'rejected')
  );