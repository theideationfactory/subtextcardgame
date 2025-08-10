-- Add chat messaging system to Subtext app
-- This migration creates tables for messages and conversations

-- Messages table for storing all chat messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'card', 'spread', 'image', 'system')),
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  spread_id UUID REFERENCES spreads(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations table for optimizing chat list queries
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  last_message_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user1_unread_count INTEGER DEFAULT 0,
  user2_unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_time ON conversations(last_message_time DESC);

-- Function to update conversation when a message is sent
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
DECLARE
  conv_id UUID;
  user1_id UUID;
  user2_id UUID;
BEGIN
  -- Determine user1 and user2 (user1 should be the smaller UUID for consistency)
  IF NEW.sender_id < NEW.receiver_id THEN
    user1_id := NEW.sender_id;
    user2_id := NEW.receiver_id;
  ELSE
    user1_id := NEW.receiver_id;
    user2_id := NEW.sender_id;
  END IF;

  -- Insert or update conversation
  INSERT INTO conversations (user1_id, user2_id, last_message_id, last_message_time)
  VALUES (user1_id, user2_id, NEW.id, NEW.created_at)
  ON CONFLICT (user1_id, user2_id)
  DO UPDATE SET
    last_message_id = NEW.id,
    last_message_time = NEW.created_at,
    user1_unread_count = CASE 
      WHEN NEW.receiver_id = conversations.user1_id THEN conversations.user1_unread_count + 1
      ELSE conversations.user1_unread_count
    END,
    user2_unread_count = CASE 
      WHEN NEW.receiver_id = conversations.user2_id THEN conversations.user2_unread_count + 1
      ELSE conversations.user2_unread_count
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation when message is inserted
CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- Function to mark messages as read and update unread counts
CREATE OR REPLACE FUNCTION mark_messages_as_read(p_sender_id UUID, p_receiver_id UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
  user1_id UUID;
  user2_id UUID;
BEGIN
  -- Update messages as read
  UPDATE messages 
  SET is_read = true, updated_at = NOW()
  WHERE sender_id = p_sender_id 
    AND receiver_id = p_receiver_id 
    AND is_read = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Determine user1 and user2 for conversation update
  IF p_sender_id < p_receiver_id THEN
    user1_id := p_sender_id;
    user2_id := p_receiver_id;
  ELSE
    user1_id := p_receiver_id;
    user2_id := p_sender_id;
  END IF;

  -- Reset unread count for the receiver
  UPDATE conversations
  SET 
    user1_unread_count = CASE 
      WHEN p_receiver_id = user1_id THEN 0
      ELSE user1_unread_count
    END,
    user2_unread_count = CASE 
      WHEN p_receiver_id = user2_id THEN 0
      ELSE user2_unread_count
    END,
    updated_at = NOW()
  WHERE user1_id = user1_id AND user2_id = user2_id;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get conversations for a user
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
      WHEN c.user1_id = p_user_id THEN u2.email
      ELSE u1.email
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

-- Function to get messages between two users
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
    u.email as sender_email
  FROM messages m
  LEFT JOIN auth.users u ON m.sender_id = u.id
  WHERE (m.sender_id = p_user1_id AND m.receiver_id = p_user2_id)
     OR (m.sender_id = p_user2_id AND m.receiver_id = p_user1_id)
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Messages policies - users can only see messages they sent or received
CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert their own messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Conversations policies - users can only see conversations they're part of
CREATE POLICY "Users can view their own conversations" ON conversations
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can insert their own conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can update their own conversations" ON conversations
  FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
