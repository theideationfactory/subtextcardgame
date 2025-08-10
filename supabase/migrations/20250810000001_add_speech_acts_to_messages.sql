-- Add speech_acts column to messages table for storing OpenAI-analyzed speech acts
ALTER TABLE messages 
ADD COLUMN speech_acts TEXT[] DEFAULT NULL;

-- Add index for better performance when querying by speech acts
CREATE INDEX idx_messages_speech_acts ON messages USING GIN (speech_acts);

-- Drop existing function first to allow return type change
DROP FUNCTION IF EXISTS get_conversation_messages(UUID, UUID, INTEGER, INTEGER);

-- Update the get_conversation_messages function to include speech_acts
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
  sender_email TEXT,
  speech_acts TEXT[]
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
    u.email::TEXT as sender_email,
    m.speech_acts
  FROM messages m
  LEFT JOIN auth.users u ON m.sender_id = u.id
  WHERE (m.sender_id = p_user1_id AND m.receiver_id = p_user2_id)
     OR (m.sender_id = p_user2_id AND m.receiver_id = p_user1_id)
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
