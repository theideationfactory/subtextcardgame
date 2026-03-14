-- Fix RLS policies for auth.users table to allow chat system access
-- This migration adds necessary policies for users to access other users' basic info for chat

-- Enable RLS on auth.users if not already enabled
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists, then recreate it
DROP POLICY IF EXISTS "Users can view other users basic info for chat" ON auth.users;

-- Policy to allow authenticated users to view basic user info (email) for chat purposes
-- This is needed for the chat system to display friend names and emails
CREATE POLICY "Users can view other users basic info for chat" ON auth.users
  FOR SELECT USING (auth.role() = 'authenticated');

-- Fix the get_user_conversations function to handle varchar(255) email type
CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  friend_id UUID,
  friend_email TEXT,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER,
  message_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as conversation_id,
    CASE 
      WHEN c.user1_id = p_user_id THEN c.user2_id
      ELSE c.user1_id
    END as friend_id,
    CASE 
      WHEN c.user1_id = p_user_id THEN u2.email::TEXT
      ELSE u1.email::TEXT
    END as friend_email,
    COALESCE(m.content, '') as last_message,
    c.last_message_time,
    CASE 
      WHEN c.user1_id = p_user_id THEN c.user1_unread_count
      ELSE c.user2_unread_count
    END as unread_count,
    COALESCE(m.message_type, 'text') as message_type
  FROM conversations c
  LEFT JOIN auth.users u1 ON c.user1_id = u1.id
  LEFT JOIN auth.users u2 ON c.user2_id = u2.id
  LEFT JOIN messages m ON c.last_message_id = m.id
  WHERE c.user1_id = p_user_id OR c.user2_id = p_user_id
  ORDER BY c.last_message_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Fix the get_conversation_messages function as well
CREATE OR REPLACE FUNCTION get_conversation_messages(p_user1_id UUID, p_user2_id UUID, p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID,
  sender_id UUID,
  receiver_id UUID,
  content TEXT,
  message_type TEXT,
  card_id UUID,
  spread_id UUID,
  is_read BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  sender_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.sender_id,
    m.receiver_id,
    m.content,
    m.message_type,
    m.card_id,
    m.spread_id,
    m.is_read,
    m.created_at,
    u.email::TEXT as sender_email
  FROM messages m
  LEFT JOIN auth.users u ON m.sender_id = u.id
  WHERE (m.sender_id = p_user1_id AND m.receiver_id = p_user2_id)
     OR (m.sender_id = p_user2_id AND m.receiver_id = p_user1_id)
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions for the chat functions to work
-- These functions need to access auth.users to get email addresses
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;
