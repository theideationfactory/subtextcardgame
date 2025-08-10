// Chat service for handling all chat-related API calls
import { supabase } from '@/lib/supabase';
import { Message, Conversation, SendMessageParams } from '@/types/chat';

export class ChatService {
  // Get all conversations for the current user
  static async getConversations(): Promise<Conversation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .rpc('get_user_conversations', { p_user_id: user.id });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  // Get messages between current user and another user
  static async getMessages(friendId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .rpc('get_conversation_messages', {
          p_user1_id: user.id,
          p_user2_id: friendId,
          p_limit: limit,
          p_offset: offset
        });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  // Send a new message
  static async sendMessage(params: SendMessageParams): Promise<Message> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const messageData = {
        sender_id: user.id,
        receiver_id: params.receiver_id,
        content: params.content,
        message_type: params.message_type || 'text',
        card_id: params.card_id || null,
        spread_id: params.spread_id || null
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select('*')
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(senderId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .rpc('mark_messages_as_read', {
          p_sender_id: senderId,
          p_receiver_id: user.id
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  // Get unread message count for current user
  static async getUnreadCount(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      return data?.length || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Create or get conversation between two users
  static async createConversation(friendId: string): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Determine user1 and user2 (user1 should be the smaller UUID)
      const user1Id = user.id < friendId ? user.id : friendId;
      const user2Id = user.id < friendId ? friendId : user.id;

      const { data, error } = await supabase
        .from('conversations')
        .upsert({
          user1_id: user1Id,
          user2_id: user2Id
        })
        .select('id')
        .single();

      if (error) throw error;

      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  // Subscribe to new messages for real-time updates
  static subscribeToMessages(callback: (message: Message) => void) {
    return supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const newMessage = payload.new as Message;
          callback(newMessage);
        }
      )
      .subscribe();
  }

  // Subscribe to conversation updates
  static subscribeToConversations(callback: (conversation: any) => void) {
    return supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations'
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();
  }

  // Send a card in chat
  static async sendCard(receiverId: string, cardId: string, cardName: string): Promise<Message> {
    return this.sendMessage({
      receiver_id: receiverId,
      content: `Shared card: ${cardName}`,
      message_type: 'card',
      card_id: cardId
    });
  }

  // Send a spread in chat
  static async sendSpread(receiverId: string, spreadId: string, spreadName: string): Promise<Message> {
    return this.sendMessage({
      receiver_id: receiverId,
      content: `Shared spread: ${spreadName}`,
      message_type: 'spread',
      spread_id: spreadId
    });
  }

  // Delete a message (soft delete by updating content)
  static async deleteMessage(messageId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('messages')
        .update({ 
          content: 'This message was deleted',
          message_type: 'system'
        })
        .eq('id', messageId)
        .eq('sender_id', user.id); // Only sender can delete

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  // Get card details for card messages
  static async getCardDetails(cardId: string) {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('id, name, description, type, image_url, frame_color')
        .eq('id', cardId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching card details:', error);
      return null;
    }
  }

  // Get spread details for spread messages
  static async getSpreadDetails(spreadId: string) {
    try {
      const { data, error } = await supabase
        .from('spreads')
        .select('id, name, description, created_at')
        .eq('id', spreadId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching spread details:', error);
      return null;
    }
  }
}
