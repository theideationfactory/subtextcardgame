import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList,
  ActivityIndicator,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, FileText, Trash2, Send, Check, X } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { log, logError } from '@/utils/logger';

// Define the structure of a draft object
interface Draft {
  id: string;
  name: string;
  last_modified: string;
  color?: string; // Optional: used for icon color
  draft_data?: any; // Optional: used for draft data
  // Add other properties from your 'spreads' table if needed elsewhere
}

interface Friend {
  friend_id: string;
  email: string;
  created_at: string;
}

// Use shared Supabase client from lib to avoid multiple auth/session streams

export default function DraftsScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'web' ? 0 : Math.max(insets.top, 4);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [currentDraftToSend, setCurrentDraftToSend] = useState<Draft | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]); // Store friend_ids
  const [sending, setSending] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  const isFetchingRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const hasFetchedOnFocusRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Keep a stable user id ref to avoid recreating callbacks
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  const fetchDrafts = useCallback(async () => {
    // Prevent duplicate fetches
    const now = Date.now();
    if (isFetchingRef.current || now - lastFetchAtRef.current < 1500) {
      // log('Already fetching or throttled, skipping...');
      return;
    }

    try {
      isFetchingRef.current = true;
      lastFetchAtRef.current = now;
      log('[Drafts] fetch start at', now);
      const showSpinner = !initialLoadDoneRef.current;
      if (showSpinner) setLoading(true);
      setError('');
      
      // Ensure user is available
      const uid = userIdRef.current;
      if (!uid) {
        throw new Error('Not authenticated');
      }
      
      log('Fetching drafts for user:', uid);
      
      const { data, error: fetchError } = await supabase
        .from('spreads')
        .select('*')
        .eq('user_id', uid)
        .eq('is_draft', true)
        .order('last_modified', { ascending: false });

      if (fetchError) throw fetchError;
      
      log('[Drafts] fetch success, count:', data?.length || 0);
      setDrafts((prev) => {
        const next = data || [];
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      
    } catch (err) {
      logError('[Drafts] fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load drafts';
      setError(errorMessage);
      
      // If unauthorized, redirect to login
      if (errorMessage.includes('auth') || errorMessage.includes('authenticated')) {
        setTimeout(() => {
          router.replace('/login');
        }, 2000);
      }
    } finally {
      log('[Drafts] fetch end');
      if (!initialLoadDoneRef.current) {
        setLoading(false);
        initialLoadDoneRef.current = true;
      }
      isFetchingRef.current = false;
    }
  }, []);

  // Fetch once per focus while screen is active
  useFocusEffect(
    useCallback(() => {
      if (!fontsLoaded) return;
      if (!userIdRef.current) return;
      if (!hasFetchedOnFocusRef.current) {
        hasFetchedOnFocusRef.current = true;
        fetchDrafts();
      }
      return () => {
        hasFetchedOnFocusRef.current = false;
      };
    }, [fontsLoaded, fetchDrafts])
  );

  const fetchFriendsForModal = useCallback(async () => {
    if (!user) return;
    setFriendsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_friends', { user_id: user.id });

      if (fetchError) throw fetchError;
      setFriends(data || []);
    } catch (err) {
      logError('Error fetching friends for modal:', err);
      setError('Failed to load friends for sharing.');
    } finally {
      setFriendsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (showSendModal && user) {
      fetchFriendsForModal();
    } else if (!showSendModal) {
      setSelectedFriends([]); // Clear selections when modal closes
    }
  }, [showSendModal, user, fetchFriendsForModal]);

  const handleSendPress = (draft: Draft) => {
    setCurrentDraftToSend(draft);
    setShowSendModal(true);
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  const handleSendDraft = async () => {
    if (!currentDraftToSend || selectedFriends.length === 0 || !user) return;

    setSending(true);
    
    try {
      log('Sharing spread:', currentDraftToSend.name);
      log('Sharing with users:', selectedFriends);
      
      // 0. First, ensure all cards in the spread are properly linked via spread_id
      const draftData = currentDraftToSend.draft_data;
      const allCardIds: string[] = [];
      
      if (draftData && draftData.zoneCards) {
        Object.values(draftData.zoneCards).forEach((cardIds: any) => {
          if (Array.isArray(cardIds)) {
            allCardIds.push(...cardIds);
          }
        });
      }
      
      if (allCardIds.length > 0) {
        log('Linking cards to spread:', allCardIds);
        const { error: linkError } = await supabase
          .from('cards')
          .update({ spread_id: currentDraftToSend.id })
          .in('id', allCardIds)
          .eq('user_id', user.id);
        
        if (linkError) {
          logError('Error linking cards to spread:', linkError);
          throw new Error(linkError.message || 'Failed to link cards to spread');
        }
      }
      
      // 1. Update the spread's shared_with_user_ids to include the selected friends
      const { data: spreadResult, error: spreadError } = await supabase
        .from('spreads')
        .update({
          shared_with_user_ids: selectedFriends,
          share_with_specific_friends: true,
          last_modified: new Date().toISOString()
        })
        .eq('id', currentDraftToSend.id)
        .eq('user_id', user.id); // Ensure only the owner can share
      
      if (spreadError) {
        logError('Error updating spread sharing:', spreadError);
        throw new Error(spreadError.message || 'Failed to share spread');
      }
      
      // 2. Update all cards in the spread to share with the same friends
      const { data: cardsResult, error: cardsError } = await supabase
        .from('cards')
        .update({
          shared_with_user_ids: selectedFriends,
          share_with_specific_friends: true
        })
        .eq('spread_id', currentDraftToSend.id)
        .eq('user_id', user.id); // Ensure only cards owned by the user are updated
      
      if (cardsError) {
        logError('Error updating cards sharing:', cardsError);
        throw new Error(cardsError.message || 'Failed to share cards in spread');
      }
      
      log('Sharing successful');
      
      // 3. Update local state
      setShowSendModal(false);
      setSelectedFriends([]);
      setCurrentDraftToSend(null);
      
      // 4. Show success message
      Alert.alert(
        'Success', 
        'Spread shared successfully!',
        [{ text: 'OK' }]
      );
      
      setError('');
    } catch (err) {
      logError('Error sharing spread:', err);
      
      // More specific error handling
      let errorMessage = 'Failed to share spread.';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      Alert.alert(
        'Sharing Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
      
      setError(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (draftId: string) => {
    try {
      setDeleting(draftId);

      // Use RPC that bypasses RLS (SECURITY DEFINER) to safely unlink all cards
      // and delete the spread in one transaction to avoid FK violations
      const { error: rpcError } = await supabase
        .rpc('delete_spread_and_unlink_cards', { target_spread_id: draftId });

      if (rpcError) {
        logError('RPC delete_spread_and_unlink_cards error:', rpcError);
        throw rpcError;
      }

      setDrafts(prev => prev.filter(draft => draft.id !== draftId));
      setError('');
    } catch (err) {
      logError('Error deleting draft:', err);
      const msg = (err as any)?.message || 'Failed to delete draft';
      setError(msg);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (date: string) => {
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    };
    return new Date(date).toLocaleString(undefined, options);
  };

  const renderDraft = ({ item }: { item: Draft }) => (
    <TouchableOpacity 
      style={styles.draftItem}
      onPress={() => router.replace({
        pathname: '/(tabs)/spread',
        params: { draftId: item.id }
      })}
    >
      <View style={styles.draftInfo}>
        <View style={styles.draftHeader}>
          <FileText size={20} color={item.color} style={styles.draftIcon} />
          <Text style={styles.draftName}>{item.name}</Text>
        </View>
        <Text style={styles.draftDate}>
          Last modified: {formatDate(item.last_modified)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.sendButton}
        onPress={() => handleSendPress(item)}
      >
        <Send size={20} color="#6366f1" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.deleteButton,
          deleting === item.id && styles.deleteButtonDisabled
        ]}
        onPress={() => handleDelete(item.id)}
        disabled={deleting === item.id}
      >
        {deleting === item.id ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Trash2 size={20} color="#ff4444" />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Spread Drafts</Text>
      </View>
      
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : drafts.length === 0 ? (
        <View style={styles.centerContent}>
          <FileText size={48} color="#666" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>No drafts yet</Text>
          <Text style={styles.emptySubtext}>
            Your saved spread drafts will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          renderItem={renderDraft}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSendModal}
        onRequestClose={() => setShowSendModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Draft</Text>
              <TouchableOpacity onPress={() => setShowSendModal(false)} style={styles.closeButton}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {friendsLoading ? (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Loading friends...</Text>
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.centerContent}>
                <Text style={styles.emptyText}>No friends found.</Text>
                <Text style={styles.emptySubtext}>Add friends to share your drafts.</Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={item => item.friend_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.friendItem}
                    onPress={() => toggleFriendSelection(item.friend_id)}
                  >
                    <Text style={styles.friendEmail}>{item.email}</Text>
                    {selectedFriends.includes(item.friend_id) && (
                      <Check size={20} color="#4CAF50" />
                    )}
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.friendsList}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelShareButton}
                onPress={() => setShowSendModal(false)}
                disabled={sending}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendShareButton, selectedFriends.length === 0 && styles.sendButtonDisabled]}
                onPress={handleSendDraft}
                disabled={selectedFriends.length === 0 || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
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
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 16,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Inter-Bold',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    padding: 16,
  },
  draftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  draftInfo: {
    flex: 1,
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  draftIcon: {
    marginRight: 8,
  },
  draftName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  draftDate: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  sendButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    marginRight: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter-Bold',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  friendsList: {
    paddingVertical: 10,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  friendEmail: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 10,
  },
  cancelShareButton: {
    backgroundColor: '#3a3a3a',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendShareButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontFamily: 'Inter-Regular',
  },
});