import { View, Text, StyleSheet, FlatList, Pressable, Image, Modal, TouchableOpacity, RefreshControl } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import { Settings2, CreditCard as Edit3, Trash2, Swords, Shield, Sparkles, Users, Globe as Globe2, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Spacer } from '@/components/Spacer';

const COLLECTION_TYPES = [
  {
    id: 'personal',
    name: 'Personal',
    icon: Lock,
    color: '#6366f1',
  },
  {
    id: 'friends',
    name: 'Friends',
    icon: Users,
    color: '#ec4899',
  },
  {
    id: 'public',
    name: 'Public',
    icon: Globe2,
    color: '#10b981',
  },
] as const;

type CollectionType = typeof COLLECTION_TYPES[number]['id'];

const getCardTypeColor = (type: string): readonly [string, string] => {
  const types: Record<string, readonly [string, string]> = {
    'Creature': ['#ff9966', '#ff5e62'],
    'Spell': ['#4e54c8', '#8f94fb'],
    'Artifact': ['#c79081', '#dfa579'],
    'Equipment': ['#3a7bd5', '#00d2ff'],
    'Land': ['#77A1D3', '#79CBCA'],
  };
  return types[type] || ['#bdc3c7', '#2c3e50'];
};

const getCardRoleIcon = (role: string) => {
  switch (role?.toLowerCase()) {
    case 'attacker':
      return <Swords size={16} color="#fff" />;
    case 'defender':
      return <Shield size={16} color="#fff" />;
    default:
      return <Sparkles size={16} color="#fff" />;
  }
};

export default function CollectionScreen() {
  const { user } = useAuth();
  // Define Card type to fix TypeScript errors
  type Card = {
    id: string;
    name: string;
    description: string;
    type: string;
    role?: string;
    context?: string;
    image_url: string;
    frame_width?: number;
    frame_color?: string;
    name_color?: string;
    type_color?: string;
    description_color?: string;
    context_color?: string;
    user_id: string;
    collection_id?: string;
    collections?: any;
  };

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [selectedType, setSelectedType] = useState<CollectionType>('personal');
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  const fetchCards = useCallback(async (isRefreshing = false) => {
    if (!user) {
      // console.log('No user found, skipping card fetch');
      return;
    }

    try {
      // console.log('Fetching cards for user:', user.id);
      if (!isRefreshing) {
        setLoading(true);
      }
      setError('');

      let query = supabase
        .from('cards')
        .select(`
          *,
          collections (*)
        `);

      switch (selectedType) {
        case 'personal':
          query = query
            .eq('user_id', user?.id || '')
            .contains('collections.visibility', ['personal']);
          break;
        case 'friends':
          const { data: friendRequests } = await supabase
            .from('friend_requests')
            .select('sender_id, receiver_id')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .eq('status', 'accepted');

          const friendIds = (friendRequests ?? []).flatMap(fr => 
            fr.sender_id === user.id ? [fr.receiver_id] : [fr.sender_id]
          );

          const { data: friendCards } = await supabase
            .from('cards')
            .select(`
              *,
              collections (*)
            `)
            .neq('user_id', user.id)
            .contains('collections.visibility', ['friends'])
            .in('user_id', friendIds);
          
          setCards(friendCards as Card[] ?? []);
          return;
        case 'public':
          query = query.contains('collections.visibility', ['public']);
          break;
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching cards:', fetchError);
        throw fetchError;
      }

      // console.log(`Fetched ${data?.length ?? 0} cards`);
      setCards(data as Card[] ?? []);
    } catch (err) {
      console.error('Error in fetchCards:', err instanceof Error ? err.message : 'Unknown error');
      setError('Failed to load cards');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedType]);

  useEffect(() => {
    if (user) {
      fetchCards(false);
    }
  }, [user, fetchCards]);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCards(true);
  }, [fetchCards]);

  const handleDelete = async (cardId: string) => {
    if (!cardId) {
      setDeleteError('Invalid card selected');
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    try {
      const { error: deleteError } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId)
        .eq('user_id', user?.id || '');

      if (deleteError) {
        throw deleteError;
      }

      setCards(prevCards => prevCards.filter(card => card.id !== cardId));
      setShowActions(false);
      setSelectedCard(null);
      
    } catch (err) {
      console.error('Delete error:', err instanceof Error ? err.message : 'Unknown error');
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete card');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEdit = (card: Card) => {
    // Ensure all values are properly serialized as strings
    const serializedParams = {
      id: card.id,
      name: card.name || '',
      description: card.description || '',
      type: card.type || '',
      role: card.role || '',
      context: card.context || '',
      image_url: card.image_url || '',
      frame_width: String(card.frame_width || 8),
      frame_color: card.frame_color || '#FFD700',
      name_color: card.name_color || '#FFFFFF',
      type_color: card.type_color || '#FFFFFF',
      description_color: card.description_color || '#FFFFFF',
      context_color: card.context_color || '#CCCCCC',
      // Add a timestamp to ensure the route is always seen as "new" by React Navigation
      _timestamp: Date.now().toString()
    };
    
    // Reset navigation stack to ensure fresh state
    router.replace({
      pathname: '/create',
      params: serializedParams
    });
    
    setShowActions(false);
  };

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  const renderCard = ({ item }: { item: Card }) => {
    const cardColors = getCardTypeColor(item.type);
    
    return (
      <Pressable style={styles.card}>
        <LinearGradient
          colors={cardColors}
          style={[
            styles.cardFrame,
            {
              borderWidth: item.frame_width || 8,
              borderColor: '#808080' // Always use gray
            }
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardContent}>
            <View style={styles.cardNameContainer}>
              <Text style={[styles.cardName, { color: item.name_color || '#FFFFFF' }]}>
                {item.name}
              </Text>
            </View>

            <View style={styles.artContainer}>
              <Image 
                source={{ uri: item.image_url }}
                style={styles.cardArt}
                resizeMode="cover"
              />
            </View>

            <View style={styles.typeLine}>
              <View style={styles.typeContainer}>
                <Text style={[styles.typeText, { color: item.type_color || '#FFFFFF' }]}>
                  {item.type || 'Card'}
                </Text>
              </View>
              {item.role && (
                <View style={styles.roleContainer}>
                  {getCardRoleIcon(item.role)}
                  <Text style={[styles.roleText, { color: item.type_color || '#FFFFFF' }]}>
                    {item.role}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.textBox}>
              <Text style={[styles.cardDescription, { color: item.description_color || '#FFFFFF' }]}>
                {item.description}
              </Text>
            </View>

            {item.context && (
              <View style={styles.contextContainer}>
                <Text style={[styles.contextText, { color: item.context_color || '#CCCCCC' }]}>
                  {item.context}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => {
                setSelectedCard(item);
                setShowActions(true);
                setDeleteError('');
              }}
            >
              <Settings2 size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Pressable>
    );
  };

  const renderCollectionTypeSelector = () => (
    <View style={styles.collectionTypeContainer}>
      {COLLECTION_TYPES.map((type) => {
        const Icon = type.icon;
        const isSelected = selectedType === type.id;
        return (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.collectionTypeButton,
              isSelected && { backgroundColor: `${type.color}33` },
            ]}
            onPress={() => setSelectedType(type.id)}
          >
            <Icon
              size={20}
              color={isSelected ? type.color : '#666'}
              style={styles.collectionTypeIcon}
            />
            <Text
              style={[
                styles.collectionTypeText,
                isSelected && { color: type.color },
              ]}
            >
              {type.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (loading) {
    return (
      <LinearGradient
        colors={['#1a1a1a', '#2a2a2a']}
        style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading your collection...</Text>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient
        colors={['#1a1a1a', '#2a2a2a']}
        style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>{error}</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#1a1a1a', '#2a2a2a']}
      style={styles.container}
      onLayout={onLayoutRootView}>
      {/* Experiment: Removed Spacer to reduce top padding */}
      {renderCollectionTypeSelector()}
      
      <FlatList
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
            colors={['#6366f1', '#ec4899', '#10b981']}
            progressBackgroundColor="#2a2a2a"
            title="Pull to refresh"
            titleColor="#ffffff"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {selectedType === 'personal'
                ? 'No cards in your collection yet.'
                : selectedType === 'friends'
                ? 'No shared cards available.'
                : 'No public cards available.'}
            </Text>
            {selectedType === 'personal' && (
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => router.push('/create')}
              >
                <Text style={styles.createButtonText}>Create Your First Card</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <Modal
        visible={showActions}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowActions(false);
          setDeleteError('');
        }}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => {
            setShowActions(false);
            setDeleteError('');
          }}
        >
          <View style={styles.modalContent}>
            {deleteError ? (
              <Text style={styles.modalErrorText}>{deleteError}</Text>
            ) : null}
            {selectedType === 'personal' && (
              <>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => selectedCard && handleEdit(selectedCard)}
                >
                  <Edit3 size={20} color="#fff" />
                  <Text style={styles.modalButtonText}>Edit Card</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.deleteButton,
                    deleteLoading && styles.buttonDisabled
                  ]}
                  onPress={() => selectedCard?.id && handleDelete(selectedCard.id)}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <Text style={[styles.modalButtonText, styles.deleteText]}>
                      Deleting...
                    </Text>
                  ) : (
                    <>
                      <Trash2 size={20} color="#ff4444" />
                      <Text style={[styles.modalButtonText, styles.deleteText]}>
                        Delete Card
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionTypeContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  collectionTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  collectionTypeIcon: {
    marginRight: 8,
  },
  collectionTypeText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
  },
  cardFrame: {
    borderRadius: 16,
    borderWidth: 8,
    borderColor: '#FFD700',
  },
  cardContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    padding: 6,
    gap: 6,
  },
  cardNameContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
  },
  cardName: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  artContainer: {
    height: 280,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardArt: {
    width: '100%',
    height: '100%',
  },
  typeLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginLeft: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginLeft: 4,
  },
  textBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
    minHeight: 100,
  },
  cardDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  contextContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  contextText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    fontStyle: 'italic',
  },
  settingsButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(8px)',
  },
  modalContent: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 24,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalButtonText: {
    color: '#fff',
    marginLeft: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  modalErrorText: {
    color: '#ff4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 12,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteText: {
    color: '#ff4444',
  },
  errorText: {
    color: '#ff4444',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingText: {
    color: '#fff',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
  },
  createButtonText: {
    color: '#fff',
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});