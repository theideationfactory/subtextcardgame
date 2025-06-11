import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { createClient } from '@supabase/supabase-js';
import { Search, UserPlus, UserCheck, UserX, Clock, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

const SECTIONS = {
  SEARCH: 'search',
  REQUESTS: 'requests',
  FRIENDS: 'friends',
} as const;

type Section = typeof SECTIONS[keyof typeof SECTIONS];

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150';

export default function FriendsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<Section>(SECTIONS.FRIENDS);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [error, setError] = useState('');

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
  }, []);

  const fetchFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .rpc('get_friends', { user_id: user.id });

      if (fetchError) throw fetchError;

      setFriends(data || []);
    } catch (err) {
      console.error('Error fetching friends:', err);
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
      console.error('Error fetching friend requests:', err);
      setError('Failed to load friend requests');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: searchError } = await supabase
        .rpc('search_users', { 
          search_query: searchQuery,
          current_user_id: user.id
        });

      if (searchError) throw searchError;

      setSearchResults(data || []);
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: insertError } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: userId,
        });

      if (insertError) throw insertError;

      // Refresh search results to update status
      handleSearch();
    } catch (err) {
      console.error('Error sending friend request:', err);
      setError('Failed to send friend request');
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
      console.error('Error accepting friend request:', err);
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
      console.error('Error rejecting friend request:', err);
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
        onChangeText={setSearchQuery}
        onSubmitEditing={handleSearch}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TouchableOpacity
        style={styles.searchButton}
        onPress={handleSearch}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Search size={20} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSectionSelector = () => (
    <View style={styles.sectionSelector}>
      {Object.entries(SECTIONS).map(([key, value]) => (
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

  const renderUserItem = ({ item, type }) => (
    <View style={styles.userItem}>
      <Image
        source={{ uri: DEFAULT_AVATAR }}
        style={styles.avatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.email}</Text>
        {type === 'search' && item.friendship_status !== 'none' && (
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
      {type === 'search' && item.friendship_status === 'none' && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleSendRequest(item.id)}
        >
          <UserPlus size={20} color="#6366f1" />
        </TouchableOpacity>
      )}
      {type === 'request' && (
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAcceptRequest(item.request_id)}
          >
            <UserCheck size={20} color="#4CAF50" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRejectRequest(item.request_id)}
          >
            <UserX size={20} color="#ff4444" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    switch (activeSection) {
      case SECTIONS.SEARCH:
        return (
          <>
            {renderSearchBar()}
            <FlatList
              data={searchResults}
              renderItem={({ item }) => renderUserItem({ item, type: 'search' })}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Search size={48} color="#666" />
                  <Text style={styles.emptyText}>
                    Search for users to add as friends
                  </Text>
                </View>
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
      case SECTIONS.FRIENDS:
        return (
          <FlatList
            data={friends}
            renderItem={({ item }) => renderUserItem({ item, type: 'friend' })}
            keyExtractor={item => item.friend_id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Users size={48} color="#666" />
                <Text style={styles.emptyText}>
                  Add some friends to get started
                </Text>
              </View>
            }
          />
        );
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2a2a2a',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
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
    color: '#6366f1',
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
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
});