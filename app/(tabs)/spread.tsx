import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  FlatList,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { createClient } from '@supabase/supabase-js';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Target, 
  Shield, 
  Book, 
  Plus, 
  X, 
  CirclePlus as PlusCircle,
  Heart,
  MessageCircle,
  Lightbulb,
  Users,
  Sparkles,
  ArrowLeft,
  FileText,
  Save,
  RotateCcw,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Spacer } from '@/components/Spacer';
import { hasDynamicIsland } from '@/utils/deviceDimensions';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SPREADS = {
  invitation: {
    name: 'Invitation',
    description: 'A spread for planning important conversations',
    color: '#FFD700',
    icon: MessageCircle,
    zones: [
      {
        name: 'intention',
        title: 'Intention',
        color: '#FFD700',
        icon: Target,
        description: 'What do you hope will come from this conversation for yourself and for the other person?',
      },
      {
        name: 'foundation',
        title: 'Foundation',
        color: '#4CAF50',
        icon: Shield,
        description: "What's your motivation for initiating this conversation? Why do you want the outcomes you mentioned above?",
      },
      {
        name: 'context',
        title: 'Context',
        color: '#2196F3',
        icon: Book,
        description: 'Write what the event or situation was that sparked wanting to talk',
      },
    ],
  },
  reflection: {
    name: 'Reflection',
    description: 'A spread for personal growth and insight',
    color: '#9C27B0',
    icon: Sparkles,
    zones: [
      {
        name: 'insight',
        title: 'Insight',
        color: '#9C27B0',
        icon: Lightbulb,
        description: 'What have you learned about yourself recently?',
      },
      {
        name: 'challenge',
        title: 'Challenge',
        color: '#FF5722',
        icon: Shield,
        description: 'What obstacles are you currently facing?',
      },
      {
        name: 'growth',
        title: 'Growth',
        color: '#4CAF50',
        icon: Heart,
        description: 'How do you want to grow from this experience?',
      },
    ],
  },
  connection: {
    name: 'Connection',
    description: 'A spread for understanding relationships',
    color: '#E91E63',
    icon: Users,
    zones: [
      {
        name: 'self',
        title: 'Self',
        color: '#E91E63',
        icon: Heart,
        description: 'How do you show up in this relationship?',
      },
      {
        name: 'other',
        title: 'Other',
        color: '#2196F3',
        icon: Users,
        description: 'What do you observe about the other person?',
      },
      {
        name: 'bridge',
        title: 'Bridge',
        color: '#4CAF50',
        icon: Sparkles,
        description: 'What connects you both? What could strengthen your bond?',
      },
    ],
  },
};

export default function SpreadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { cards, fetchCards } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [activeZone, setActiveZone] = useState(null);
  const [selectedSpread, setSelectedSpread] = useState(null);
  const [zoneCards, setZoneCards] = useState({});
  const [currentSpreadId, setCurrentSpreadId] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [spreadName, setSpreadName] = useState('');
  const [cardMap, setCardMap] = useState({});
  const [galleryLoading, setGalleryLoading] = useState(false);
  
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    const initializeScreen = async () => {
      try {
        setLoading(true);
        await fetchCards();
      } catch (err) {
        console.error('Error initializing screen:', err);
        setError('Failed to initialize screen');
      } finally {
        setLoading(false);
      }
    };

    initializeScreen();
  }, []);

  useEffect(() => {
    if (showGallery) {
      fetchCards();
    }
  }, [showGallery, fetchCards]);

  useEffect(() => {
    if (params.draftId) {
      loadDraft(params.draftId);
    }
  }, [params.draftId, cards]);

  const handleShowGallery = useCallback((zoneName: string) => {
    setActiveZone(zoneName);
    setShowGallery(true);
    if (cards.length === 0) {
      fetchCards();
    }
  }, [cards.length, fetchCards]);

  const checkForExistingDraft = async (spreadType) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: latestDraft, error: draftError } = await supabase
        .from('spreads')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_draft', true)
        .eq('draft_data->>type', spreadType)
        .order('last_modified', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (draftError) {
        throw draftError;
      }

      if (latestDraft?.draft_data?.zoneCards) {
        setSpreadName(latestDraft.name || SPREADS[spreadType].name);
        setCurrentSpreadId(latestDraft.id);

        const cardsById = cards.reduce((acc, card) => {
          acc[card.id] = card;
          return acc;
        }, {});
        setCardMap(cardsById);

        const restoredZoneCards = {};
        Object.entries(latestDraft.draft_data.zoneCards).forEach(([zoneName, cardIds]) => {
          restoredZoneCards[zoneName] = cardIds.map(id => cardsById[id]).filter(Boolean);
        });
        setZoneCards(restoredZoneCards);
      } else {
        const initialZoneCards = {};
        SPREADS[spreadType].zones.forEach(zone => {
          initialZoneCards[zone.name] = [];
        });
        setZoneCards(initialZoneCards);
        setSpreadName(SPREADS[spreadType].name);
      }
    } catch (err) {
      console.error('Error checking for existing draft:', err);
      setError('Failed to check for existing draft');
    }
  };

  const loadDraft = async (draftId) => {
    try {
      const { data: draft, error: draftError } = await supabase
        .from('spreads')
        .select('*')
        .eq('id', draftId)
        .single();

      if (draftError) throw draftError;

      if (draft?.draft_data?.type && draft?.draft_data?.zoneCards) {
        setSelectedSpread(draft.draft_data.type);
        setSpreadName(draft.name || SPREADS[draft.draft_data.type].name);
        setCurrentSpreadId(draft.id);

        const cardsById = cards.reduce((acc, card) => {
          acc[card.id] = card;
          return acc;
        }, {});
        setCardMap(cardsById);

        const restoredZoneCards = {};
        Object.entries(draft.draft_data.zoneCards).forEach(([zoneName, cardIds]) => {
          restoredZoneCards[zoneName] = cardIds.map(id => cardsById[id]).filter(Boolean);
        });
        setZoneCards(restoredZoneCards);
      }
    } catch (err) {
      console.error('Error loading draft:', err);
      setError('Failed to load draft');
    }
  };

  const saveDraft = async (name?: string) => {
    if (!selectedSpread) return;

    try {
      setSavingDraft(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const zoneCardIds = {};
      Object.entries(zoneCards).forEach(([zoneName, cards]) => {
        zoneCardIds[zoneName] = cards.map(card => card.id);
      });

      const draftData = {
        type: selectedSpread,
        zoneCards: zoneCardIds,
      };

      const spreadNameToUse = (name && name.trim()) || spreadName || SPREADS[selectedSpread].name;
      const iconName = SPREADS[selectedSpread]?.icon?.name || 'Sparkles';

      if (currentSpreadId) {
        const { error: updateError } = await supabase
          .from('spreads')
          .update({
            name: spreadNameToUse,
            draft_data: draftData,
          })
          .eq('id', currentSpreadId);

        if (updateError) throw updateError;
      } else {
        const { data: newDraft, error: insertError } = await supabase
          .from('spreads')
          .insert({
            name: spreadNameToUse,
            description: SPREADS[selectedSpread].description,
            color: SPREADS[selectedSpread].color,
            icon: iconName,
            user_id: user.id,
            zones: [],
            is_draft: true,
            draft_data: draftData,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setCurrentSpreadId(newDraft.id);
      }

      if (name && name.trim()) {
        setSpreadName(name.trim());
      }

    } catch (err) {
      console.error('Error saving draft:', err);
      setError('Failed to save draft');
    } finally {
      setSavingDraft(false);
      setShowSaveAs(false);
    }
  };

  const resetSpreadTitle = async () => {
    if (!selectedSpread) return;
    
    try {
      setSavingDraft(true);
      const defaultName = SPREADS[selectedSpread].name;
      setSpreadName(defaultName);

      if (currentSpreadId) {
        const { error: updateError } = await supabase
          .from('spreads')
          .update({
            name: defaultName,
          })
          .eq('id', currentSpreadId);

        if (updateError) throw updateError;
      }
    } catch (err) {
      console.error('Error resetting spread name:', err);
      setError('Failed to reset spread name');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleAddCard = (card) => {
    if (!activeZone) return;
    
    setZoneCards(prev => ({
      ...prev,
      [activeZone]: [...(prev[activeZone] || []), card],
    }));
    
    setShowGallery(false);
    setActiveZone(null);
  };

  const handleCreateCard = () => {
    setShowGallery(false);
    setActiveZone(null);
    router.push('/create');
  };

  const renderSpreadOption = (spreadKey) => {
    const spread = SPREADS[spreadKey];
    const Icon = spread.icon;

    return (
      <TouchableOpacity
        key={spreadKey}
        style={styles.spreadOption}
        onPress={() => {
          setSelectedSpread(spreadKey);
          checkForExistingDraft(spreadKey);
        }}
      >
        <LinearGradient
          colors={[`${spread.color}33`, `${spread.color}11`]}
          style={styles.spreadOptionGradient}
        >
          <Icon size={24} color={spread.color} />
          <Text style={styles.spreadOptionTitle}>{spread.name}</Text>
          <Text style={styles.spreadOptionDescription}>{spread.description}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderGalleryItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.galleryItem}
      onPress={() => handleAddCard(item)}
    >
      <Image
        source={{ uri: item.image_url }}
        style={styles.galleryImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.galleryItemOverlay}
      >
        <Text style={styles.galleryItemName} numberOfLines={2}>
          {item.name}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderGalleryContent = () => {
    if (galleryLoading) {
      return (
        <View style={styles.galleryLoadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.galleryLoadingText}>Loading your cards...</Text>
        </View>
      );
    }

    if (cards.length === 0) {
      return (
        <View style={styles.emptyGallery}>
          <Text style={styles.emptyText}>No cards available</Text>
          <Text style={styles.emptySubtext}>
            Create some cards in your collection first
          </Text>
          <TouchableOpacity 
            style={styles.createFirstCardButton}
            onPress={handleCreateCard}
          >
            <PlusCircle size={20} color="#fff" style={styles.createCardIcon} />
            <Text style={styles.createCardText}>Create Your First Card</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={cards}
        renderItem={renderGalleryItem}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.galleryGrid}
      />
    );
  };

  const renderGalleryModal = () => (
    <Modal
      visible={showGallery}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setShowGallery(false);
        setActiveZone(null);
      }}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select a Card</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowGallery(false);
                setActiveZone(null);
              }}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.createCardButton}
            onPress={handleCreateCard}
          >
            <PlusCircle size={20} color="#fff" style={styles.createCardIcon} />
            <Text style={styles.createCardText}>Create New Card</Text>
          </TouchableOpacity>
          
          {renderGalleryContent()}
        </View>
      </View>
    </Modal>
  );

  const renderDropZone = (zone) => {
    const Icon = zone.icon;
    const cards = zoneCards[zone.name] || [];

    return (
      <View style={styles.dropZone} key={zone.name}>
        <LinearGradient
          colors={[`${zone.color}33`, `${zone.color}11`]}
          style={styles.dropZoneGradient}
        >
          <View style={styles.dropZoneHeader}>
            <View style={styles.headerLeft}>
              <Icon size={16} color={zone.color} />
              <Text style={styles.dropZoneTitle}>{zone.title}</Text>
            </View>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: `${zone.color}33` }]}
              onPress={() => handleShowGallery(zone.name)}
            >
              <Plus size={16} color={zone.color} />
            </TouchableOpacity>
          </View>
          <Text style={styles.dropZoneDescription}>{zone.description}</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.cardScroll}
            contentContainerStyle={styles.cardScrollContent}
          >
            {cards.map((card, index) => (
              <View key={`${card.id}-${index}`} style={styles.miniCard}>
                <Image
                  source={{ uri: card.image_url }}
                  style={styles.miniCardImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.miniCardOverlay}
                >
                  <Text style={styles.miniCardName} numberOfLines={1}>
                    {card.name}
                  </Text>
                </LinearGradient>
              </View>
            ))}
          </ScrollView>
        </LinearGradient>
      </View>
    );
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!selectedSpread) {
    return (
      <View style={styles.container}>
        <Spacer backgroundColor="#121212" />
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Choose a Spread</Text>
          <TouchableOpacity 
            style={styles.draftsButton}
            onPress={() => router.push('/drafts')}
          >
            <FileText size={20} color="#6366f1" />
            <Text style={styles.draftsButtonText}>Drafts</Text>
          </TouchableOpacity>
        </View>
        <ScrollView 
          style={styles.spreadSelector}
          contentContainerStyle={styles.spreadSelectorContent}
        >
          {Object.keys(SPREADS).map(renderSpreadOption)}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setSelectedSpread(null)}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.spreadTitle}>
            {spreadName || SPREADS[selectedSpread].name}
          </Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetSpreadTitle}
          >
            <RotateCcw size={16} color="#666" />
          </TouchableOpacity>
        </View>
        {savingDraft && (
          <ActivityIndicator size="small" color="#6366f1" style={styles.savingIndicator} />
        )}
        <TouchableOpacity
          style={styles.saveAsButton}
          onPress={() => setShowSaveAs(true)}
        >
          <Save size={20} color="#6366f1" />
        </TouchableOpacity>
      </View>

      <View style={styles.dropZonesContainer}>
        {SPREADS[selectedSpread].zones.map(renderDropZone)}
      </View>

      {renderGalleryModal()}

      <Modal
        visible={showSaveAs}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSaveAs(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, styles.saveAsModal]}>
            <Text style={styles.modalTitle}>Save Spread As</Text>
            <TextInput
              style={styles.saveAsInput}
              placeholder="Enter spread name"
              placeholderTextColor="#666"
              value={spreadName}
              onChangeText={setSpreadName}
            />
            <View style={styles.saveAsButtons}>
              <TouchableOpacity
                style={[styles.saveAsActionButton, styles.saveButton]}
                onPress={() => saveDraft(spreadName)}
                disabled={!spreadName.trim() || savingDraft}
              >
                {savingDraft ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveAsButtonText}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveAsActionButton, styles.cancelButton]}
                onPress={() => setShowSaveAs(false)}
                disabled={savingDraft}
              >
                <Text style={styles.saveAsButtonText}>Cancel</Text>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  pageTitle: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Inter-Bold',
  },
  draftsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  draftsButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  spreadSelector: {
    flex: 1,
  },
  spreadSelectorContent: {
    padding: 16,
    gap: 16,
  },
  spreadOption: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  spreadOptionGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  spreadOptionTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter-Bold',
  },
  spreadOptionDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 16,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spreadTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter-Bold',
  },
  resetButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  savingIndicator: {
    marginLeft: 16,
  },
  saveAsButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    marginLeft: 16,
  },
  dropZonesContainer: {
    flex: 1,
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  dropZone: {
    height: SCREEN_HEIGHT / 3 - 20,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  dropZoneGradient: {
    flex: 1,
    padding: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  dropZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropZoneTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginLeft: 8,
  },
  addButton: {
    padding: 6,
    borderRadius: 6,
  },
  dropZoneDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
    lineHeight: 18,
  },
  cardScroll: {
    flex: 1,
  },
  cardScrollContent: {
    paddingVertical: 4,
  },
  miniCard: {
    width: 120,
    height: 168,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  miniCardImage: {
    width: '100%',
    height: '100%',
  },
  miniCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
  },
  miniCardName: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    marginTop: hasDynamicIsland() ? 80 : 60, // More margin for Dynamic Island
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
  },
  saveAsModal: {
    flex: 0,
    margin: 20,
    padding: 20,
    borderRadius: 16,
    maxWidth: 400,
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  createCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    margin: 16,
    padding: 12,
    borderRadius: 12,
  },
  createCardIcon: {
    marginRight: 8,
  },
  createCardText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  galleryGrid: {
    padding: 8,
  },
  galleryItem: {
    flex: 1,
    margin: 8,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
    minWidth: 150,
    maxWidth: '45%',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  galleryItemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  galleryItemName: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    paddingHorizontal: 8,
  },
  emptyGallery: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  saveAsInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    marginBottom: 20,
  },
  saveAsButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  saveAsActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#6366f1',
  },
  cancelButton: {
    backgroundColor: '#3a3a3a',
  },
  saveAsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  galleryLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  galleryLoadingText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginTop: 12,
  },
  createFirstCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
});