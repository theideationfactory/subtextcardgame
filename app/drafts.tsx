import { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { useRouter } from 'expo-router';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, FileText, Trash2, Send, Check, X } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Define the structure of a draft object
interface Draft {
  id: string;
  name: string;
  last_modified: string;
  color?: string; // Optional: used for icon color
  // Add other properties from your 'spreads' table if needed elsewhere
}

interface Friend {
  friend_id: string;
  email: string;
  created_at: string;
}

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

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

  useEffect(() => {
    const checkAuthAndFetchDrafts = async () => {
      try {
        // Wait for auth loading to complete
        if (authLoading) return;
        
        // Check if we have a valid user
        if (!user) {
          console.error('No authenticated user');
          setError('Please log in to view your drafts');
          // Redirect to login screen after a short delay
          setTimeout(() => {
            router.replace('/login');
          }, 2000);
          return;
        }
        
        // If we have a user, fetch drafts
        await fetchDrafts();
      } catch (err) {
        console.error('Error in auth check:', err);
        setError('Authentication error. Please log in again.');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuthAndFetchDrafts();
  }, [user, authLoading]);

  const fetchFriendsForModal = useCallback(async () => {
    if (!user) return;
    setFriendsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_friends', { user_id: user.id });

      if (fetchError) throw fetchError;
      setFriends(data || []);
    } catch (err) {
      console.error('Error fetching friends for modal:', err);
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
      // First, get the full draft data to duplicate
      const { data: originalDraft, error: fetchError } = await supabase
        .from('spreads')
        .select('*')
        .eq('id', currentDraftToSend.id)
        .single();

      if (fetchError) throw fetchError;
      if (!originalDraft) throw new Error('Could not find the original draft');
      
      // Create a new shared draft with "Shared" in the title
      const sharedDraftName = `${originalDraft.name} (Shared)`;
      
      // Create a complete copy of all fields from the original draft
      const sharedDraft = {
        // Copy all fields from the original draft
        ...originalDraft,
        // Override specific fields for the shared version
        id: undefined, // Remove ID so a new one is generated
        name: sharedDraftName,
        is_draft: true,
        user_id: user.id,
        shared_with_user_ids: selectedFriends,
        share_with_specific_friends: true, // Set this to true to indicate specific sharing
        last_modified: new Date().toISOString()
      };
      
      // Ensure all required fields have default values if missing
      if (!sharedDraft.color) sharedDraft.color = '#6366f1';
      if (!sharedDraft.icon) sharedDraft.icon = 'FileText';
      if (!sharedDraft.description) sharedDraft.description = 'Shared spread';
      if (!sharedDraft.zones) sharedDraft.zones = [];
      
      console.log('Creating shared draft with data:', JSON.stringify(sharedDraft, null, 2));
      
      // Insert the complete shared draft FIRST, before updating cards
      const { data: newDraft, error: insertError } = await supabase
        .from('spreads')
        .insert(sharedDraft)
        .select()
        .single();

      if (insertError) throw insertError;
      if (!newDraft) throw new Error('Failed to create new shared draft');
      
      // Double-check that shared_with_user_ids was properly set
      if (!newDraft.shared_with_user_ids || newDraft.shared_with_user_ids.length === 0) {
        console.warn('shared_with_user_ids was not set properly on the new draft. Updating directly...');
        
        // Update the draft directly to ensure shared_with_user_ids is set
        const { error: updateError } = await supabase
          .from('spreads')
          .update({ 
            shared_with_user_ids: selectedFriends,
            share_with_specific_friends: true
          })
          .eq('id', newDraft.id);
          
        if (updateError) {
          console.error('Error updating shared_with_user_ids:', updateError);
        }
      }

      // Extract card IDs from the original draft's draft_data.zoneCards
      let cardIdsToShare: string[] = [];
      if (originalDraft.draft_data && originalDraft.draft_data.zoneCards) {
        const zoneCards = originalDraft.draft_data.zoneCards as Record<string, string[]>; // Type assertion
        const allCardIds = Object.values(zoneCards).flat();
        cardIdsToShare = [...new Set(allCardIds)]; // Get unique card IDs
      }
      
      if (cardIdsToShare.length > 0) {
        console.log('Sharing cards with specific users:', cardIdsToShare);
        
        // First, fetch the current shared_with_user_ids for all cards
        const { data: cardsData, error: fetchCardsError } = await supabase
          .from('cards')
          .select('id, user_id, shared_with_user_ids, share_with_specific_friends')
          .in('id', cardIdsToShare);
          
        if (fetchCardsError) {
          console.error('Error fetching cards:', fetchCardsError);
          throw new Error('Failed to fetch cards for sharing.');
        }
        
        console.log('Cards fetched:', cardsData);
        console.log('User context:', user);
        
        // For each card, create a new copy with the shared_with_user_ids updated
        const oldToNewCardIds: Record<string, string> = {};
        for (const card of cardsData || []) {
          console.log('Card ownership:', card);
          console.log('User ID:', user.id);
          console.log('Card user ID:', card.user_id);
          if (card.user_id !== user.id) {
            console.error('Card is not owned by the current user. Skipping update.');
            continue;
          }
          
          // Create a new array with existing shared_with_user_ids plus new friends
          const currentSharedWith = card.shared_with_user_ids || [];
          const newSharedWith = [...new Set([...currentSharedWith, ...selectedFriends])];
          
          console.log(`Creating new card copy with updated shared_with_user_ids:`, {
            current: { shared_with_user_ids: currentSharedWith, share_with_specific_friends: card.share_with_specific_friends },
            new: { shared_with_user_ids: newSharedWith, share_with_specific_friends: true, spread_id: newDraft.id }
          });
          
          const newCard = {
            ...card,
            id: undefined, // Remove ID so a new one is generated
            shared_with_user_ids: newSharedWith,
            share_with_specific_friends: true,
            spread_id: newDraft.id // Link card to the shared spread created earlier
          };
          
          const { data: newCardData, error: insertCardError } = await supabase
            .from('cards')
            .insert(newCard)
            .select()
            .single();
            
          if (insertCardError) {
            console.error(`Error inserting new card copy ${card.id}:`, insertCardError);
            console.log('Error details:', insertCardError.details);
            console.log('Error hint:', insertCardError.hint);
            console.log('Error code:', insertCardError.code);
            throw new Error('Failed to insert new card copy for sharing.');
          } else {
            console.log(`✅ New card copy ${newCardData.id} inserted successfully:`, newCardData);
            oldToNewCardIds[card.id] = newCardData.id;
          }
        }
        
        console.log(`Successfully shared cards with ${selectedFriends.length} users.`);
        
        // Update the shared spread's zoneCards with new card IDs
        const zoneCards = originalDraft.draft_data.zoneCards as Record<string, string[]>; // Type assertion
        const updatedZoneCards = Object.fromEntries(
          Object.entries(zoneCards).map(([zone, cardIds]) => [
            zone,
            cardIds.map(cardId => oldToNewCardIds[cardId] || cardId)
          ])
        );
        
        const { error: updateZoneCardsError } = await supabase
          .from('spreads')
          .update({
            draft_data: {
              ...originalDraft.draft_data,
              zoneCards: updatedZoneCards
            }
          })
          .eq('id', newDraft.id);
          
        if (updateZoneCardsError) {
          console.error('Error updating zoneCards:', updateZoneCardsError);
        }
      }

      console.log(`Created shared draft ${newDraft.id} from ${currentDraftToSend.id}, shared with:`, selectedFriends);
      
      // No need to update the original draft
      // Just add the new draft to the local state
      setDrafts(prevDrafts => [
        {
          id: newDraft.id,
          name: sharedDraftName,
          last_modified: newDraft.last_modified,
          color: originalDraft.color
        },
        ...prevDrafts
      ]);


      setShowSendModal(false);
      setSelectedFriends([]);
      setCurrentDraftToSend(null);
      setError('');
    } catch (err) {
      console.error('Error creating shared draft:', err);
      setError('Failed to create shared draft.');
    } finally {
      setSending(false);
    }
  };

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Ensure user is available
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      console.log('Fetching drafts for user:', user.id);
      
      const { data, error: fetchError } = await supabase
        .from('spreads')
        .select('*')
        .eq('user_id', user.id)
        .order('last_modified', { ascending: false });

      if (fetchError) throw fetchError;
      
      console.log('Fetched drafts:', data?.length || 0);
      setDrafts(data || []);
      
    } catch (err) {
      console.error('Error fetching drafts:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load drafts';
      setError(errorMessage);
      
      // If unauthorized, redirect to login
      if (errorMessage.includes('auth') || errorMessage.includes('authenticated')) {
        setTimeout(() => {
          router.replace('/login');
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (draftId: string) => {
    try {
      setDeleting(draftId);
      const { error: deleteError } = await supabase
        .from('spreads')
        .delete()
        .eq('id', draftId);

      if (deleteError) throw deleteError;
      setDrafts(drafts.filter(draft => draft.id !== draftId));
    } catch (err) {
      console.error('Error deleting draft:', err);
      setError('Failed to delete draft');
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