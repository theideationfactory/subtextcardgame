// Chat system types for Subtext app

export type MessageType = 'text' | 'card' | 'spread' | 'image' | 'system';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: MessageType;
  card_id?: string;
  spread_id?: string;
  is_read: boolean;
  created_at: string;
  sender_email?: string;
  speech_acts?: string[];
}

export interface Conversation {
  conversation_id: string;
  friend_id: string;
  friend_email: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  message_type: MessageType;
  is_online?: boolean;
  friend_avatar?: string;
}

export interface ChatUser {
  id: string;
  email: string;
  is_online?: boolean;
  last_seen?: string;
  avatar_url?: string;
}

export interface SendMessageParams {
  receiver_id: string;
  content: string;
  message_type?: MessageType;
  card_id?: string;
  spread_id?: string;
}

export interface ChatScreenParams {
  friendId: string;
  friendEmail: string;
}
