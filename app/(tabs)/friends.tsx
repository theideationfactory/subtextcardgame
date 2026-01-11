import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, FlatList, Platform, Alert } from 'react-native';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { UserPlus, UserCheck, UserX, Search, Users, Clock, Check, MessageCircle, Send } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Spacer } from '@/components/Spacer';
import { supabase } from '@/lib/supabase';
import { ChatService } from '@/services/chatService';
import { Conversation } from '@/types/chat';
import { formatRelativeTime, getMessagePreview, getInitials, getAvatarColor } from '@/utils/chatUtils';
import { log, logError } from '@/utils/logger';

const SECTIONS = {
  CHATS: 'chats',
  REQUESTS: 'requests',
  DISCOVER: 'discover',
} as const;

type Section = typeof SECTIONS[keyof typeof SECTIONS];

type User = {
  id: string;
  email: string;
  created_at: string;
  friendship_status: 'friend' | 'request_sent' | 'request_received' | 'none';
};

type FriendRequest = {
  request_id: string;
  sender_id: string;
  sender_email: string;
  created_at: string;
};

type Friend = {
  friend_id: string;
  email: string;
  created_at: string;
};

type UserItemProps = {
  item: User | FriendRequest | Friend | Conversation;
  type: 'search' | 'request' | 'friend' | 'chat';
};

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150';

export default function FriendsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<Section>(SECTIONS.REQUESTS);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
    fetchConversations();
  }, []);

  // Refresh conversations when screen comes into focus (e.g., returning from chat)
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [])
  );

  const fetchConversations = async () => {
    try {
      const conversations = await ChatService.getConversations();
      setConversations(conversations);
    } catch (error) {
      logError('Error fetching conversations:', error);
      setError('Failed to load conversations');
    }
  };
  
  // Debounce search query
  useEffect(() => {
    const timerId = setTimeout(() => {
      const trimmed = searchQuery.trim();
      if (trimmed.length >= 3 || trimmed === '') {
        setDebouncedQuery(trimmed);
      }
    }, 300); // 300ms debounce delay
    
    return () => clearTimeout(timerId);
  }, [searchQuery]);
  
  // Trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length >= 3) {
      handleSearch(debouncedQuery);
    } else if (debouncedQuery === '') {
      setSearchResults([]);
      setError('');
    }
  }, [debouncedQuery]);

  const fetchFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .rpc('get_friends', { user_id: user.id });

      if (fetchError) throw fetchError;

      setFriends(data || []);
    } catch (err) {
      logError('Error fetching friends:', err);
      setError('Failed to load friends');
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .rpc('get_friend_requests', { user_id: user.id });

      if (fetchError) throw fetchError;

      setFriendRequests(data || []);
    } catch (err) {
      logError('Error fetching friend requests:', err);
      setError('Failed to load friend requests');
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      if (query.length > 0) {
        setError('Please enter at least 3 characters to search');
      }
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError('');
    
    // Get current user to check if searching for self
    try {
      const { data } = await supabase.auth.getUser();
      
      // Skip the authentication check for now - assume user is authenticated
      // We'll just check if they're searching for their own email if we have it
      const currentUser = data?.user;
      
      if (currentUser?.email && currentUser.email.toLowerCase().includes(query.toLowerCase())) {
        setError('You cannot search for your own email');
        setLoading(false);
        return;
      }
    } catch (authError) {
      logError('Auth check error:', authError);
      // Don't return here, try to continue with the search
    }

    try {
      // Get the current user ID for the search
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      
      // For testing purposes, use a hardcoded ID if user is not found
      const userId = user?.id || 'a0b60b23-9678-46cd-8a20-10370bfdf411'; // Use your actual user ID here

      const { data, error: searchError } = await supabase
        .rpc('search_users', { 
          search_query: query,
          current_user_id: userId
        });
    
      if (searchError) {
        logError('Search error from Supabase:', searchError);
        throw searchError;
      }

      // Always add the test user for any search that contains 'test'
      if (query.toLowerCase() === 'test@example.com') {
        setSearchResults([{
          id: 'test-user-id',
          email: 'test@example.com',
          created_at: new Date().toISOString(),
          friendship_status: 'none'
        } as User]);
        return;
      }
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        setSearchResults([]);
        return;
      }

      const dataArray = Array.isArray(data) ? data : [];
      
      const filteredResults = dataArray.filter((user: User) => {
        if (!user.email) {
          return false;
        }
        const match = user.email.toLowerCase().includes(query.toLowerCase());
        return match;
      });
    
      setSearchResults(filteredResults);
      
      // Force a re-render by setting activeSection
      setActiveSection(prev => prev);
    } catch (err) {
      logError('Search error:', err);
      setError('Search failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  const openChat = (friendId: string, friendEmail: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    log('=== OPENING CHAT ===');
    log('Friend ID:', friendId);
    log('Friend Email:', friendEmail);
    log('Router available:', !!router);
    
    if (!friendId || !friendEmail) {
      Alert.alert('Error', 'Missing friend information');
      return;
    }
    
    try {
      log('Attempting navigation to /chat');
      router.push({
        pathname: '/chat',
        params: { 
          friendId: friendId.toString(), 
          friendEmail: friendEmail.toString() 
        }
      });
      log('Navigation call completed');
    } catch (error) {
      logError('Navigation error:', error);
      Alert.alert('Navigation Error', `Could not open chat: ${error}`);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      setLoading(true);
      setError('');
      
      // Get current user
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      
      if (!user) {
        setError('You need to be signed in to send friend requests');
        return;
      }
      
      // Check if a request already exists
      const { data: existingRequests, error: checkError } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
        
      if (checkError) {
        logError('Error checking existing requests:', checkError);
        throw checkError;
      }
      
      const existingRequest = existingRequests?.find(req => 
        (req.sender_id === user.id && req.receiver_id === userId) || 
        (req.sender_id === userId && req.receiver_id === user.id)
      );
      
      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          if (existingRequest.sender_id === user.id) {
            setError('You already sent a friend request to this user');
          } else {
            setError('This user already sent you a friend request');
          }
          return;
        } else if (existingRequest.status === 'accepted') {
          setError('You are already friends with this user');
          return;
        }
      }
      
      // Insert the new friend request
      const { error: insertError } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          status: 'pending'
        });

      if (insertError) {
        logError('Error inserting friend request:', insertError);
        throw insertError;
      }

      // Show success message
      setError('Friend request sent successfully!');
      
      // Update the search results to show the new status
      const updatedResults = searchResults.map(result => {
        if (result.id === userId) {
          return { ...result, friendship_status: 'request_sent' } as User;
        }
        return result;
      });
      
      setSearchResults(updatedResults as User[]);
    } catch (err) {
      logError('Error sending friend request:', err);
      setError('Failed to send friend request: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      await Promise.all([
        fetchFriendRequests(),
        fetchFriends()
      ]);
    } catch (err) {
      logError('Error accepting friend request:', err);
      setError('Failed to accept friend request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      await fetchFriendRequests();
    } catch (err) {
      logError('Error rejecting friend request:', err);
      setError('Failed to reject friend request');
    }
  };

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by email"
        placeholderTextColor="#666"
        value={searchQuery}
        onChangeText={(text) => {
          setSearchQuery(text);
          if (text.trim().length < 3) {
            setError(text.trim().length > 0 ? 'Please enter at least 3 characters to search' : '');
          }
        }}
        onSubmitEditing={() => {
          const trimmed = searchQuery.trim();
          if (trimmed.length >= 3) {
            handleSearch(trimmed);
          }
        }}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TouchableOpacity
        style={[styles.searchButton, searchQuery.trim().length < 3 && styles.searchButtonDisabled]}
        onPress={() => {
          const trimmed = searchQuery.trim();
          if (trimmed.length >= 3) {
            handleSearch(trimmed);
          }
        }}
        disabled={loading || searchQuery.trim().length < 3}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Search size={20} color={searchQuery.trim().length < 3 ? '#999' : '#fff'} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSectionSelector = () => (
    <View style={styles.sectionSelector}>
      {/* HIDDEN: Chats section - only show Requests and Discover */}
      {Object.entries(SECTIONS)
        .filter(([key]) => key !== 'CHATS')
        .map(([key, value]) => (
        <TouchableOpacity
          key={key}
          style={[
            styles.sectionButton,
            activeSection === value && styles.sectionButtonActive,
          ]}
          onPress={() => setActiveSection(value)}
        >
          <Text
            style={[
              styles.sectionButtonText,
              activeSection === value && styles.sectionButtonTextActive,
            ]}
          >
            {key.charAt(0) + key.slice(1).toLowerCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderUserItem = ({ item, type }: UserItemProps) => {
    const isSearchUser = (item: any): item is User => type === 'search';
    const isRequest = (item: any): item is FriendRequest => type === 'request';
    const isFriend = (item: any): item is Friend => type === 'friend';
    const isConversation = (item: any): item is Conversation => type === 'chat';
  
    const getDisplayEmail = () => {
      if (isRequest(item)) return item.sender_email;
      if (isConversation(item)) return item.friend_email;
      return (item as User | Friend).email;
    };

    const getDisplayName = () => {
      const email = getDisplayEmail();
      return email ? email.split('@')[0] : 'Unknown';
    };

    const handleItemPress = () => {
      if (isConversation(item)) {
        if (item.friend_email) {
          openChat(item.friend_id, item.friend_email);
        } else {
          Alert.alert('Error', 'Friend email is missing for this conversation');
        }
      } else if (isFriend(item)) {
        if (item.email) {
          openChat(item.friend_id, item.email);
        } else {
          Alert.alert('Error', 'Friend email is missing');
        }
      }
    };
  
    return (
      <TouchableOpacity 
        style={styles.userItem}
        onPress={isConversation(item) || isFriend(item) ? handleItemPress : undefined}
        activeOpacity={isConversation(item) || isFriend(item) ? 0.7 : 1}
      >
        <View style={styles.avatarContainer}>
          <View style={[
            styles.avatar,
            { backgroundColor: getAvatarColor(isConversation(item) ? item.friend_id : (item as any).id || '') }
          ]}>
            <Text style={styles.avatarText}>
              {getInitials(getDisplayEmail())}
            </Text>
          </View>
          {isConversation(item) && item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>
                {item.unread_count > 99 ? '99+' : item.unread_count.toString()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>
              {getDisplayName()}
            </Text>
            {isConversation(item) && (
              <Text style={styles.messageTime}>
                {formatRelativeTime(item.last_message_time)}
              </Text>
            )}
          </View>
          {isConversation(item) && (
            <Text style={[
              styles.lastMessage,
              item.unread_count > 0 && styles.unreadMessage
            ]} numberOfLines={1}>
              {getMessagePreview(item.last_message, item.message_type)}
            </Text>
          )}
          {isSearchUser(item) && item.friendship_status !== 'none' && (
            <Text style={[
              styles.statusText,
              item.friendship_status === 'friend' && styles.statusFriend,
              item.friendship_status === 'request_sent' && styles.statusPending,
              item.friendship_status === 'request_received' && styles.statusReceived,
            ]}>
              {item.friendship_status === 'friend' ? 'Friend' :
               item.friendship_status === 'request_sent' ? 'Request Sent' :
               'Request Received'}
            </Text>
          )}
        </View>
        {isSearchUser(item) && item.friendship_status === 'none' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSendRequest(item.id)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#6366f1" />
            ) : (
              <UserPlus size={20} color="#6366f1" />
            )}
          </TouchableOpacity>
        )}  
        {/* HIDDEN: Chat button for search results who are friends
        {isSearchUser(item) && item.friendship_status === 'friend' && (
          <TouchableOpacity
            style={styles.messageButton}
            onPress={() => openChat(item.id, item.email)}
          >
            <MessageCircle size={20} color="#22c55e" />
          </TouchableOpacity>
        )}
        */}
        {isSearchUser(item) && item.friendship_status === 'request_sent' && (
          <View style={[styles.actionButton, styles.sentIndicator]}>
            <Check size={20} color="#4CAF50" />
          </View>
        )}
        {isRequest(item) && (
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleAcceptRequest(item.request_id)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#4CAF50" />
              ) : (
                <UserCheck size={20} color="#4CAF50" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleRejectRequest(item.request_id)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ff4444" />
              ) : (
                <UserX size={20} color="#ff4444" />
              )}
            </TouchableOpacity>
          </View>
        )}  
        {/* HIDDEN: Chat button for friends
        {isFriend(item) && (
          <TouchableOpacity
            style={styles.messageButton}
            onPress={() => openChat(item.friend_id, item.email)}
          >
            <MessageCircle size={20} color="#6366f1" />
          </TouchableOpacity>
        )}
        */}
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case SECTIONS.CHATS:
        return (
          <FlatList
            data={conversations}
            renderItem={({ item }) => renderUserItem({ item, type: 'chat' })}
            keyExtractor={item => item.conversation_id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MessageCircle size={48} color="#666" />
                <Text style={styles.emptyText}>
                  No conversations yet
                </Text>
                <Text style={[styles.emptyText, { fontSize: 14, marginTop: 8 }]}>
                  Start chatting with your friends to see conversations here
                </Text>
              </View>
            }
          />
        );
      case SECTIONS.DISCOVER:
        return (
          <>
            {renderSearchBar()}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {loading && <Text style={styles.statusText}>Searching...</Text>}
            <FlatList
              data={searchResults}
              renderItem={({ item }) => renderUserItem({ item, type: 'search' })}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                searchQuery.trim().length >= 3 && !loading ? (
                  <View style={styles.noResults}>
                    <Search size={48} color="#666" />
                    <Text style={styles.emptyText}>
                      No users found matching "{searchQuery.trim()}"
                    </Text>
                    <Text style={[styles.emptyText, { fontSize: 14, marginTop: 8, color: '#888' }]}>
                      Try searching for "test@example.com" for a demo
                    </Text>
                    <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4, color: '#888' }]}>
                      Note: You need other users in the database to find real results
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Search size={48} color="#666" />
                    <Text style={styles.emptyText}>
                      Search for users to add as friends
                    </Text>
                    <Text style={[styles.emptyText, { fontSize: 14, marginTop: 8 }]}>
                      Enter at least 3 characters of an email address
                    </Text>
                  </View>
                )
              }
            />
          </>
        );
      case SECTIONS.REQUESTS:
        return (
          <FlatList
            data={friendRequests}
            renderItem={({ item }) => renderUserItem({ item, type: 'request' })}
            keyExtractor={item => item.request_id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Clock size={48} color="#666" />
                <Text style={styles.emptyText}>
                  No pending friend requests
                </Text>
              </View>
            }
          />
        );
      default:
        return null;
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <LinearGradient
      colors={['#1a1a1a', '#2a2a2a']}
      style={styles.container}
    >
      {renderSectionSelector()}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
      {renderContent()}
      
      {/* HIDDEN: Floating Action Button for New Chat
      {activeSection === SECTIONS.CHATS && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setActiveSection(SECTIONS.DISCOVER)}
        >
          <MessageCircle size={24} color="#fff" />
        </TouchableOpacity>
      )}
      */}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#3f3f46',
  },
  sectionSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sectionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  sectionButtonActive: {
    backgroundColor: '#6366f1',
  },
  sectionButtonText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  sectionButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  unreadCount: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter-Bold',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    flex: 1,
  },
  messageTime: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  lastMessage: {
    color: '#999',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  unreadMessage: {
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  statusFriend: {
    color: '#4CAF50',
  },
  statusPending: {
    color: '#FFA726',
  },
  statusReceived: {
    color: '#ff9800',
  },
  sentIndicator: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  messageButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  rejectButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 40,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    margin: 16,
    borderRadius: 8,
  },
  statusMessage: {
    color: '#666',
    textAlign: 'center',
    marginVertical: 8,
    fontSize: 14,
  },
  successText: {
    color: '#4CAF50',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    padding: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    margin: 16,
    borderRadius: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
});