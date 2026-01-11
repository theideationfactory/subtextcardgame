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
  Image,
  Pressable,
  Modal,
  Animated,
  Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Send, Plus, Image as ImageIcon, Flag, MoreHorizontal, FileText } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Spacer } from '@/components/Spacer';
import { supabase } from '@/lib/supabase';
import { ChatService } from '@/services/chatService';
import { Message } from '@/types/chat';
import { formatMessageTime, shouldShowDateSeparator, getInitials, getAvatarColor } from '@/utils/chatUtils';
import { log, logError } from '@/utils/logger';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150';

export default function ChatScreen() {
  const { friendId, friendEmail } = useLocalSearchParams<{
    friendId: string;
    friendEmail: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  log('=== CHAT SCREEN LOADED ===');
  log('Received friendId:', friendId);
  log('Received friendEmail:', friendEmail);
  log('Params type:', typeof friendId, typeof friendEmail);
  

  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [headerHeight, setHeaderHeight] = useState(56);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [analyzingMessage, setAnalyzingMessage] = useState<string | null>(null);
  const [actionToolbarVisible, setActionToolbarVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [toolbarSize, setToolbarSize] = useState({ width: 0, height: 0 });
  const [lastTouch, setLastTouch] = useState<{ x: number; y: number; isMy: boolean } | null>(null);
  const [selectedSpeechAct, setSelectedSpeechAct] = useState<string | null>(null);
  const [responseStrategies, setResponseStrategies] = useState<string[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  // Load messages and set up real-time subscription
  useEffect(() => {
    log('Chat useEffect running...');
    if (!friendId) {
      log('No friendId, skipping useEffect');
      return;
    }

    try {
      log('Loading messages and getting current user...');
      loadMessages();
      getCurrentUser();
      
      // Set up real-time subscription
      log('Setting up real-time subscription...');
      const subscription = ChatService.subscribeToMessages(async (newMessage) => {
        if (
          (newMessage.sender_id === friendId && newMessage.receiver_id === currentUserId) ||
          (newMessage.sender_id === currentUserId && newMessage.receiver_id === friendId)
        ) {
          setMessages(prev => [newMessage, ...prev]);
          
          // Auto-analyze the new message for speech acts
          try {
            const speechActs = await ChatService.analyzeSpeechActs(newMessage.id, newMessage.content);
            setMessages(prev => prev.map(msg => 
              msg.id === newMessage.id 
                ? { ...msg, speech_acts: speechActs }
                : msg
            ));
          } catch (analysisError) {
            log('Auto-analysis failed for incoming message:', analysisError);
          }
          
          // Mark as read if message is from friend
          if (newMessage.sender_id === friendId) {
            ChatService.markMessagesAsRead(friendId);
          }
        }
      });

      return () => {
        log('Cleaning up chat subscription...');
        subscription.unsubscribe();
      };
    } catch (error) {
      logError('Error in chat useEffect:', error);
    }
  }, [friendId, currentUserId]);

  // Track keyboard visibility and height to adjust menu positioning
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt as any, (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvt as any, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Recalculate toolbar position once we know its measured size
  useEffect(() => {
    if (!actionToolbarVisible || !lastTouch || !toolbarSize.width || !toolbarSize.height) return;

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const margin = 16; // edge padding
    const gap = 12; // gap between touch point and toolbar

    const tbWidth = toolbarSize.width;
    const tbHeight = toolbarSize.height;

    const desiredX = lastTouch.isMy ? lastTouch.x - tbWidth - gap : lastTouch.x + gap;
    const x = Math.max(margin, Math.min(desiredX, screenWidth - tbWidth - margin));

    const topMargin = Math.max(insets.top + headerHeight + 8, 8);
    // When keyboard is visible, reduce available height by keyboard height
    const effectiveScreenHeight = keyboardVisible ? screenHeight - keyboardHeight : screenHeight;
    const bottomMargin = Math.max(insets.bottom, 8);
    const aboveY = lastTouch.y - tbHeight - 12; // prefer above message
    let y: number;
    if (aboveY >= topMargin) {
      y = aboveY;
    } else {
      const belowY = lastTouch.y + 12;
      y = Math.max(topMargin, Math.min(belowY, effectiveScreenHeight - tbHeight - bottomMargin));
    }

    setToolbarPosition({ x, y });
  }, [actionToolbarVisible, lastTouch, toolbarSize.width, toolbarSize.height, insets.top, insets.bottom, headerHeight, keyboardVisible, keyboardHeight]);

  const getCurrentUser = async () => {
    try {
      log('Getting current user...');
      const { data: { user } } = await supabase.auth.getUser();
      log('Current user result:', user?.id);
      if (user) {
        setCurrentUserId(user.id);
        log('Set current user ID:', user.id);
      } else {
        log('No user found');
      }
    } catch (error) {
      logError('Error getting current user:', error);
    }
  };

  const loadMessages = async () => {
    if (!friendId) {
      log('No friendId in loadMessages');
      return;
    }

    try {
      log('Loading messages for friendId:', friendId);
      setLoading(true);
      const fetchedMessages = await ChatService.getMessages(friendId);
      log('Fetched messages count:', fetchedMessages.length);
      setMessages(fetchedMessages);
      
      // Mark messages as read
      log('Marking messages as read...');
      await ChatService.markMessagesAsRead(friendId);
      log('Messages marked as read');
    } catch (error) {
      logError('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
      log('Loading messages completed');
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || sending || !friendId) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const sentMessage = await ChatService.sendMessage({
        receiver_id: friendId,
        content: messageText
      });

      // Auto-analyze the sent message for speech acts
      if (sentMessage?.id) {
        try {
          const speechActs = await ChatService.analyzeSpeechActs(sentMessage.id, messageText);
          // Update local state with speech acts
          setMessages(prev => prev.map(msg => 
            msg.id === sentMessage.id 
              ? { ...msg, speech_acts: speechActs }
              : msg
          ));
        } catch (analysisError) {
          log('Auto-analysis failed:', analysisError);
          // Don't show error to user, just log it
        }
      }

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      logError('Error sending message:', error);
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

  const handleMessageLongPress = (message: Message, event: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Get touch position and compute initial placement with clamping
    const { pageX, pageY } = event.nativeEvent;
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const isMyMessage = message.sender_id === currentUserId;

    // Calculate effective screen height first
    const effectiveScreenHeight = keyboardVisible ? screenHeight - keyboardHeight : screenHeight;
    
    // Adjust touch Y coordinate when keyboard is visible
    // The touch coordinate is relative to full screen, but we need it relative to visible area
    const adjustedPageY = keyboardVisible ? Math.min(pageY, effectiveScreenHeight) : pageY;
    
    // Save for potential reflow after measurement
    setLastTouch({ x: pageX, y: adjustedPageY, isMy: isMyMessage });

    // Use measured size if available; fall back to reasonable defaults
    const tbWidth = toolbarSize.width || 260;
    const tbHeight = toolbarSize.height || 60;
    const margin = 16; // edge padding
    const gap = 12; // distance from touch

    const desiredX = isMyMessage ? pageX - tbWidth - gap : pageX + gap;
    const x = Math.max(margin, Math.min(desiredX, screenWidth - tbWidth - margin));

    const topMargin = Math.max(insets.top + headerHeight + 8, 8);
    const bottomMargin = Math.max(insets.bottom, 8);
    
    const aboveY = adjustedPageY - tbHeight - 12; // prefer above
    let y: number;
    if (aboveY >= topMargin) {
      y = aboveY;
    } else {
      const belowY = adjustedPageY + 12;
      y = Math.max(topMargin, Math.min(belowY, effectiveScreenHeight - tbHeight - bottomMargin));
    }

    setToolbarPosition({ x, y });
    setSelectedMessage(message);
    setActionToolbarVisible(true);
  };

  const handleToolbarAction = async (action: 'request' | 'reveal' | 'other') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    const currentMessage = selectedMessage;
    setActionToolbarVisible(false);
    setSelectedMessage(null);
    
    // Handle different actions
    switch (action) {
      case 'request':
        if (currentMessage) {
          await handleSpeechActRequest(currentMessage);
        }
        break;
      case 'reveal':
        Alert.alert('Reveal', 'Reveal message functionality coming soon!');
        break;
      case 'other':
        Alert.alert('More Options', 'Additional options coming soon!');
        break;
    }
  };

  const handleSpeechActRequest = async (message: Message) => {
    try {
      setAnalyzingMessage(message.id);
      
      // Call OpenAI to analyze speech acts
      const speechActs = await ChatService.analyzeSpeechActs(message.id, message.content);
      
      // Update the message in local state
      setMessages(prev => prev.map(msg => 
        msg.id === message.id 
          ? { ...msg, speech_acts: speechActs }
          : msg
      ));
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
    } catch (error) {
      logError('Error analyzing speech acts:', error);
      Alert.alert('Error', 'Failed to analyze message. Please try again.');
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setAnalyzingMessage(null);
    }
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
        
        {isMyMessage ? (
          // User messages - align to right
          <View style={styles.myMessageContainer}>
            <Pressable
              style={[styles.messageBubble, styles.myMessage]}
              onLongPress={(event) => handleMessageLongPress(item, event)}
              delayLongPress={500}
            >
              {item.message_type === 'card' ? (
                <CardMessage cardId={item.card_id} content={item.content} />
              ) : item.message_type === 'spread' ? (
                <SpreadMessage spreadId={item.spread_id} content={item.content} />
              ) : (
                <LinearGradient
                  colors={['#6366f1', '#8b5cf6']}
                  style={styles.messageGradient}
                >
                  <Text style={styles.messageText}>{item.content}</Text>
                  
                  {/* Speech Acts Display */}
                  {item.speech_acts && item.speech_acts.length > 0 && (
                    <View style={styles.speechActsContainer}>
                      {item.speech_acts.map((act, index) => (
                        <View key={index} style={styles.speechActTag}>
                          <Text style={styles.speechActText}>{act}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {/* Analysis Loading Indicator */}
                  {analyzingMessage === item.id && (
                    <View style={styles.analyzingContainer}>
                      <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                      <Text style={styles.analyzingText}>Analyzing...</Text>
                    </View>
                  )}
                  
                  <Text style={styles.messageTime}>
                    {formatMessageTime(item.created_at)}
                  </Text>
                </LinearGradient>
              )}
            </Pressable>
          </View>
        ) : (
          // Friend messages - align to left with avatar
          <View style={styles.theirMessageContainer}>
            <View style={styles.avatarContainer}>
              <View style={[styles.messageAvatar, { backgroundColor: getAvatarColor(item.sender_id) }]}>
                <Text style={styles.avatarText}>
                  {getInitials(friendEmail || '')}
                </Text>
              </View>
            </View>
            
            <Pressable
              style={[styles.messageBubble, styles.theirMessage]}
              onLongPress={(event) => handleMessageLongPress(item, event)}
              delayLongPress={500}
            >
              {item.message_type === 'card' ? (
                <CardMessage cardId={item.card_id} content={item.content} />
              ) : item.message_type === 'spread' ? (
                <SpreadMessage spreadId={item.spread_id} content={item.content} />
              ) : (
                <LinearGradient
                  colors={['#2a2a2a', '#3a3a3a']}
                  style={styles.messageGradient}
                >
                  <Text style={styles.messageText}>{item.content}</Text>
                  
                  {/* Speech Acts Display */}
                  {item.speech_acts && item.speech_acts.length > 0 && (
                    <View style={styles.speechActsContainer}>
                      {item.speech_acts.map((act, index) => (
                        <View key={index} style={styles.speechActTag}>
                          <Text style={styles.speechActText}>{act}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {/* Analysis Loading Indicator */}
                  {analyzingMessage === item.id && (
                    <View style={styles.analyzingContainer}>
                      <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                      <Text style={styles.analyzingText}>Analyzing...</Text>
                    </View>
                  )}
                  
                  <Text style={styles.messageTime}>
                    {formatMessageTime(item.created_at)}
                  </Text>
                </LinearGradient>
              )}
            </Pressable>
          </View>
        )}
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

  const handleSpeechActClick = async (speechAct: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (selectedSpeechAct === speechAct) {
      // If already selected, deselect
      setSelectedSpeechAct(null);
      setResponseStrategies([]);
      return;
    }

    setSelectedSpeechAct(speechAct);
    setLoadingStrategies(true);

    try {
      const strategies = await ChatService.generateResponseStrategies(speechAct);
      setResponseStrategies(strategies);
    } catch (error) {
      logError('Error generating response strategies:', error);
      Alert.alert('Error', 'Failed to generate response strategies');
      setSelectedSpeechAct(null);
    } finally {
      setLoadingStrategies(false);
    }
  };

  const renderToolbox = () => {
    // Collect all speech acts from messages
    const allSpeechActs = messages
      .filter(msg => msg.speech_acts && msg.speech_acts.length > 0)
      .flatMap(msg => msg.speech_acts || []);
    
    // Count occurrences of each speech act
    const speechActCounts = allSpeechActs.reduce((acc, act) => {
      acc[act] = (acc[act] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Get unique speech acts sorted by frequency
    const uniqueSpeechActs = Object.entries(speechActCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([act, count]) => ({ act, count }));

    return (
      <View style={styles.toolboxContainer}>
        <View style={styles.toolboxContent}>
          {uniqueSpeechActs.length > 0 ? (
            <>
              {uniqueSpeechActs.map(({ act, count }) => (
                <TouchableOpacity
                  key={act}
                  style={[
                    styles.toolboxSpeechActTag,
                    selectedSpeechAct === act && styles.toolboxSpeechActTagSelected
                  ]}
                  onPress={() => handleSpeechActClick(act)}
                >
                  <Text style={[
                    styles.toolboxSpeechActText,
                    selectedSpeechAct === act && styles.toolboxSpeechActTextSelected
                  ]}>
                    {act} {count > 1 && `(${count})`}
                  </Text>
                </TouchableOpacity>
              ))}
              
              {/* Response Strategies */}
              {selectedSpeechAct && (
                <>
                  {loadingStrategies ? (
                    <View style={styles.strategiesLoading}>
                      <ActivityIndicator size="small" color="#6366f1" />
                      <Text style={styles.strategiesLoadingText}>Loading...</Text>
                    </View>
                  ) : (
                    responseStrategies.map((strategy, index) => (
                      <View key={`${selectedSpeechAct}-${index}`} style={styles.responseStrategyTag}>
                        <Text style={styles.responseStrategyText}>
                          {strategy}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              )}
            </>
          ) : (
            <Text style={styles.toolboxPlaceholder}>
              Use "Request" to analyze conversation patterns
            </Text>
          )}
        </View>
      </View>
    );
  };

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
        
        {renderToolbox()}
        {renderInputBar()}
      </KeyboardAvoidingView>
      
      {/* Message Action Toolbar */}
      <Modal
        visible={actionToolbarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setActionToolbarVisible(false);
          setSelectedMessage(null);
        }}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => {
            setActionToolbarVisible(false);
            setSelectedMessage(null);
          }}
        >
          <LinearGradient
            colors={['#2a2a2a', '#1a1a1a']}
            style={[
              styles.actionToolbar,
              {
                left: toolbarPosition.x,
                top: toolbarPosition.y,
              }
            ]}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width !== toolbarSize.width || height !== toolbarSize.height) {
                setToolbarSize({ width, height });
              }
            }}
          >
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleToolbarAction('request')}
            >
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                style={styles.actionButtonGradient}
              >
                <FileText size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Request</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.actionSeparator} />
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleToolbarAction('reveal')}
            >
              <LinearGradient
                colors={['#ef4444', '#dc2626']}
                style={styles.actionButtonGradient}
              >
                <Flag size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Reveal</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.actionSeparator} />
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleToolbarAction('other')}
            >
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.actionButtonGradient}
              >
                <MoreHorizontal size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Other</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Pressable>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    marginBottom: 12,
    width: '100%',
  },
  theirMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    marginBottom: 12,
    width: '100%',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  actionToolbar: {
    position: 'absolute',
    backgroundColor: 'rgba(42, 42, 42, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 2,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionSeparator: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 4,
  },
  speechActsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  speechActTag: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  speechActText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
  },
  analyzingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 2,
  },
  analyzingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
  },
  toolboxContainer: {
    backgroundColor: 'rgba(42, 42, 42, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 50,
  },
  toolboxContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  toolboxLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginRight: 8,
  },
  toolboxSpeechActTag: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginHorizontal: 2,
  },
  toolboxSpeechActText: {
    color: 'rgba(99, 102, 241, 1)',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  toolboxPlaceholder: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
  },
  toolboxSpeechActTagSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.4)',
    borderColor: 'rgba(99, 102, 241, 0.8)',
    transform: [{ scale: 1.05 }],
  },
  toolboxSpeechActTextSelected: {
    color: 'rgba(99, 102, 241, 1)',
    fontFamily: 'Inter-Bold',
  },
  strategiesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  strategiesLoadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontFamily: 'Inter-Regular',
  },
  responseStrategyTag: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginHorizontal: 2,
  },
  responseStrategyText: {
    color: 'rgba(34, 197, 94, 1)',
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
});
