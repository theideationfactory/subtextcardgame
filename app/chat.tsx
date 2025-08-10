import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Send, Plus, Image as ImageIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Spacer } from '@/components/Spacer';
import { supabase } from '@/lib/supabase';
import { ChatService } from '@/services/chatService';
import { Message } from '@/types/chat';
import { formatMessageTime, shouldShowDateSeparator, getInitials, getAvatarColor } from '@/utils/chatUtils';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150';

export default function ChatScreen() {
  const { friendId, friendEmail } = useLocalSearchParams<{
    friendId: string;
    friendEmail: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  console.log('=== CHAT SCREEN LOADED ===');
  console.log('Received friendId:', friendId);
  console.log('Received friendEmail:', friendEmail);
  console.log('Params type:', typeof friendId, typeof friendEmail);
  

  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [headerHeight, setHeaderHeight] = useState(56);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  // Load messages and set up real-time subscription
  useEffect(() => {
    console.log('Chat useEffect running...');
    if (!friendId) {
      console.log('No friendId, skipping useEffect');
      return;
    }

    try {
      console.log('Loading messages and getting current user...');
      loadMessages();
      getCurrentUser();
      
      // Set up real-time subscription
      console.log('Setting up real-time subscription...');
      const subscription = ChatService.subscribeToMessages((newMessage) => {
        if (
          (newMessage.sender_id === friendId && newMessage.receiver_id === currentUserId) ||
          (newMessage.sender_id === currentUserId && newMessage.receiver_id === friendId)
        ) {
          setMessages(prev => [newMessage, ...prev]);
          
          // Mark as read if message is from friend
          if (newMessage.sender_id === friendId) {
            ChatService.markMessagesAsRead(friendId);
          }
        }
      });

      return () => {
        console.log('Cleaning up chat subscription...');
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('Error in chat useEffect:', error);
    }
  }, [friendId, currentUserId]);

  // Track keyboard visibility to shrink bottom padding while typing
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt as any, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt as any, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const getCurrentUser = async () => {
    try {
      console.log('Getting current user...');
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user result:', user?.id);
      if (user) {
        setCurrentUserId(user.id);
        console.log('Set current user ID:', user.id);
      } else {
        console.log('No user found');
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const loadMessages = async () => {
    if (!friendId) {
      console.log('No friendId in loadMessages');
      return;
    }

    try {
      console.log('Loading messages for friendId:', friendId);
      setLoading(true);
      const fetchedMessages = await ChatService.getMessages(friendId);
      console.log('Fetched messages count:', fetchedMessages.length);
      setMessages(fetchedMessages);
      
      // Mark messages as read
      console.log('Marking messages as read...');
      await ChatService.markMessagesAsRead(friendId);
      console.log('Messages marked as read');
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
      console.log('Loading messages completed');
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || sending || !friendId) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      await ChatService.sendMessage({
        receiver_id: friendId,
        content: messageText
      });

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setInputText(messageText); // Restore message text on error
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.sender_id === currentUserId;
    const previousMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const showDateSeparator = shouldShowDateSeparator(item.created_at, previousMessage?.created_at);

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateText}>
              {formatMessageTime(item.created_at)}
            </Text>
          </View>
        )}
        
        <View style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer
        ]}>
          {!isMyMessage && (
            <View style={styles.avatarContainer}>
              <View style={[styles.messageAvatar, { backgroundColor: getAvatarColor(item.sender_id) }]}>
                <Text style={styles.avatarText}>
                  {getInitials(friendEmail || '')}
                </Text>
              </View>
            </View>
          )}
          
          <View style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessage : styles.theirMessage
          ]}>
            {item.message_type === 'card' ? (
              <CardMessage cardId={item.card_id} content={item.content} />
            ) : item.message_type === 'spread' ? (
              <SpreadMessage spreadId={item.spread_id} content={item.content} />
            ) : (
              <LinearGradient
                colors={isMyMessage ? ['#6366f1', '#8b5cf6'] : ['#2a2a2a', '#3a3a3a']}
                style={styles.messageGradient}
              >
                <Text style={styles.messageText}>{item.content}</Text>
                <Text style={styles.messageTime}>
                  {formatMessageTime(item.created_at)}
                </Text>
              </LinearGradient>
            )}
          </View>
          
          {isMyMessage && <View style={styles.avatarSpacer} />}
        </View>
      </View>
    );
  };

  const CardMessage = ({ cardId, content }: { cardId?: string; content: string }) => {
    const [cardData, setCardData] = useState<any>(null);

    useEffect(() => {
      if (cardId) {
        ChatService.getCardDetails(cardId).then(setCardData);
      }
    }, [cardId]);

    return (
      <TouchableOpacity style={styles.cardMessage}>
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          style={styles.cardMessageGradient}
        >
          {cardData?.image_url && (
            <Image source={{ uri: cardData.image_url }} style={styles.cardImage} />
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{cardData?.name || 'Card'}</Text>
            <Text style={styles.cardDescription}>{cardData?.description || content}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const SpreadMessage = ({ spreadId, content }: { spreadId?: string; content: string }) => {
    const [spreadData, setSpreadData] = useState<any>(null);

    useEffect(() => {
      if (spreadId) {
        ChatService.getSpreadDetails(spreadId).then(setSpreadData);
      }
    }, [spreadId]);

    return (
      <TouchableOpacity style={styles.spreadMessage}>
        <LinearGradient
          colors={['#10b981', '#059669']}
          style={styles.spreadMessageGradient}
        >
          <Text style={styles.spreadTitle}>{spreadData?.name || 'Spread'}</Text>
          <Text style={styles.spreadDescription}>{spreadData?.description || content}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <ArrowLeft size={24} color="#fff" />
      </TouchableOpacity>
      
      <View style={styles.headerInfo}>
        <View style={[styles.headerAvatar, { backgroundColor: getAvatarColor(friendId || '') }]}>
          <Text style={styles.headerAvatarText}>
            {getInitials(friendEmail || '')}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{friendEmail}</Text>
          <Text style={styles.headerSubtitle}>Online</Text>
        </View>
      </View>
      
      <View style={styles.headerActions}>
        {/* Future: Add video call, voice call buttons */}
      </View>
    </View>
  );

  const renderInputBar = () => (
    <View
      style={[
        styles.inputContainer,
        {
          paddingTop: 8,
          paddingBottom: keyboardVisible ? 6 : Math.max(6, insets.bottom),
          paddingHorizontal: 12,
        },
      ]}
    >
      <TouchableOpacity style={styles.attachButton}>
        <Plus size={24} color="#6366f1" />
      </TouchableOpacity>
      
      <TextInput
        ref={inputRef}
        style={styles.textInput}
        value={inputText}
        onChangeText={setInputText}
        placeholder="Type a message..."
        placeholderTextColor="#666"
        multiline
        maxLength={1000}
      />
      
      <TouchableOpacity
        style={[
          styles.sendButton,
          (!inputText.trim() || sending) && styles.sendButtonDisabled
        ]}
        onPress={handleSendMessage}
        disabled={!inputText.trim() || sending}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Send size={20} color={inputText.trim() ? "#fff" : "#666"} />
        )}
      </TouchableOpacity>
    </View>
  );

  if (!fontsLoaded) {
    return null;
  }

  if (loading) {
    return (
      <LinearGradient colors={['#1a1a1a', '#2a2a2a']} style={styles.container}>
        <Spacer size={0} backgroundColor="transparent" />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a1a1a', '#2a2a2a']} style={styles.container}>
      <Spacer size={0} backgroundColor="transparent" />
      {renderHeader()}
      
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={messages.length === 0 ? styles.messagesContentEmpty : styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          inverted
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                Start your conversation with {friendEmail}
              </Text>
            </View>
          }
        />
        
        {renderInputBar()}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  headerSubtitle: {
    color: '#4CAF50',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  messagesContentEmpty: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  avatarSpacer: {
    width: 40,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  messageGradient: {
    padding: 12,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  cardMessage: {
    maxWidth: '75%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardMessageGradient: {
    padding: 12,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardInfo: {
    gap: 4,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  cardDescription: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  spreadMessage: {
    maxWidth: '75%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  spreadMessageGradient: {
    padding: 12,
  },
  spreadTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  spreadDescription: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    gap: 12,
  },
  attachButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#3f3f46',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
});
