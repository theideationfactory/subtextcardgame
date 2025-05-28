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
  SafeAreaView,
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
  Maximize2,
  Minimize2,
  Grid,
  Eye,
  EyeOff,
  Mail, // Added for Inbox button
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

type SpreadType = 'retroflect' | 'invitation' | 'reflection' | 'connection';

const SPREADS: Record<SpreadType, {
  name: string;
  description: string;
  color: string;
  icon: any; // Using any for LucideIcon type
  zones: Array<{
    name: string;
    title: string;
    color: string;
    icon: any; // Using any for LucideIcon type
    description: string;
  }>;
}> = {
  retroflect: {
    name: 'Retroflect',
    description: 'A spread for distilling the details of a past conversation',
    color: '#FF9800',
    icon: RotateCcw,
    zones: [
      {
        name: 'their_moves',
        title: 'Their Moves',
        color: '#FF9800',
        icon: MessageCircle,
        description: 'What I think they said and did',
      },
      {
        name: 'my_impact',
        title: 'My Impact',
        color: '#E91E63',
        icon: Heart,
        description: 'How I experienced their moves',
      },
      {
        name: 'my_response',
        title: 'My Response',
        color: '#2196F3',
        icon: MessageCircle,
        description: 'What I think I said and did in response',
      },
    ],
  },
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
  const { cards, fetchCards, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [selectedSpread, setSelectedSpread] = useState<SpreadType | null>(null);
  const [zoneCards, setZoneCards] = useState<Record<string, any[]>>({});
  const [currentSpreadId, setCurrentSpreadId] = useState<string | null>(null);
  const [spreadName, setSpreadName] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [cardMap, setCardMap] = useState<Record<string, any>>({});
  const [fullscreenZone, setFullscreenZone] = useState<string | null>(null);
  const [numColumns, setNumColumns] = useState(1);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [gallerySearchQuery, setGallerySearchQuery] = useState('');
  const [filteredCards, setFilteredCards] = useState<any[]>([]);
  const [showFullCardView, setShowFullCardView] = useState(false);
  const [selectedCardForFullView, setSelectedCardForFullView] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState('');

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
    const loadDraftIfNeeded = async () => {
      if (params.draftId) {
        const draftIdToLoad = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId;
        if (draftIdToLoad) { // Ensure we have a valid ID after potential array access
          try {
            // Ensure cards are loaded first
            if (!cards || cards.length === 0) {
              await fetchCards();
            }
            await loadDraft(draftIdToLoad);
          } catch (err) {
            console.error('Error loading draft:', err);
            setError('Failed to load draft. Please try again.');
          }
        }
      }
    };

    loadDraftIfNeeded();
  }, [params.draftId, cards.length]); // Only depend on cards.length, not the entire cards array

  const handleShowGallery = useCallback((zoneName: string) => {
    setActiveZone(zoneName);
    setShowGallery(true);
    // Initialize filteredCards with all cards when opening the gallery
    setFilteredCards(cards);
    setGallerySearchQuery(''); // Reset search query
  }, [cards]);

  // Initialize filteredCards when cards change
  useEffect(() => {
    if (showGallery) {
      setFilteredCards(cards);
    }
  }, [cards, showGallery]);

  const toggleFullscreen = (zoneName: string) => {
    if (fullscreenZone === zoneName) {
      setFullscreenZone(null);
      setNumColumns(1);
    } else {
      setFullscreenZone(zoneName);
      setNumColumns(3); // Default to 3 columns when entering fullscreen
    }
  };

  const changeColumnLayout = (columns: number) => {
    setNumColumns(columns);
  };

  const checkForExistingDraft = async (spreadType: SpreadType) => {
    try {
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
        setSpreadName(latestDraft.name || SPREADS[spreadType as keyof typeof SPREADS].name);
        setCurrentSpreadId(latestDraft.id);

        const cardsById: Record<string, any> = cards.reduce((acc: Record<string, any>, card) => {
          acc[card.id] = card;
          return acc;
        }, {});
        setCardMap(cardsById);

        const restoredZoneCards: Record<string, any[]> = {};
        Object.entries(latestDraft.draft_data.zoneCards).forEach(([zoneName, cardIds]: [string, any]) => {
          restoredZoneCards[zoneName] = (cardIds as string[]).map((id: string) => cardsById[id]).filter(Boolean);
        });
        setZoneCards(restoredZoneCards);
      } else {
        const initialZoneCards: Record<string, any[]> = {};
        SPREADS[spreadType as keyof typeof SPREADS].zones.forEach(zone => {
          initialZoneCards[zone.name] = [];
        });
        setZoneCards(initialZoneCards);
        setSpreadName(SPREADS[spreadType as keyof typeof SPREADS].name);
      }
    } catch (err) {
      console.error('Error checking for existing draft:', err);
      setError('Failed to check for existing draft');
    }
  };

  const loadDraft = async (draftId: string) => {
    try {
      // Ensure cards are loaded first
      if (!cards || cards.length === 0) {
        await fetchCards();
      }

      const { data: draft, error: draftError } = await supabase
        .from('spreads')
        .select('*')
        .eq('id', draftId)
        .single();

      if (draftError) throw draftError;

      if (draft?.draft_data?.type && draft?.draft_data?.zoneCards) {
        setSelectedSpread(draft.draft_data.type);
        setSpreadName(draft.name || SPREADS[draft.draft_data.type as SpreadType].name);
        setCurrentSpreadId(draft.id);

        // Create a fresh cardsById map with the latest cards
        const cardsById: Record<string, any> = {};
        cards.forEach(card => {
          cardsById[card.id] = card;
        });
        setCardMap(cardsById);

        const restoredZoneCards: Record<string, any[]> = {};
        Object.entries(draft.draft_data.zoneCards).forEach(([zoneName, cardIds]: [string, any]) => {
          restoredZoneCards[zoneName] = (cardIds as string[])
            .map((id: string) => cardsById[id])
            .filter(Boolean);
        });
        setZoneCards(restoredZoneCards);
      }
    } catch (err) {
      console.error('Error loading draft:', err);
      setError('Failed to load draft. Please try again.');
    }
  };

  const saveDraft = async (name?: string) => {
    if (!selectedSpread) {
      console.error('No spread selected');
      return false;
    }

    try {
      setSavingDraft(true);
      
      // Check if user is authenticated using AuthContext
      if (!user || !user.id) {
        console.error('No authenticated user from AuthContext');
        const error = new Error('No authenticated user');
        console.error('Auth error details:', { user, hasId: user?.id ? 'yes' : 'no' });
        throw error;
      }
      
      console.log('Saving draft for user:', user.id);
      
      // Log authentication state
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session ? 'exists' : 'null');
      console.log('Session user ID:', session?.user?.id);
      console.log('AuthContext user ID:', user.id);
      
      // Prepare zone cards data
      const zoneCardIds: Record<string, string[]> = {};
      Object.entries(zoneCards).forEach(([zoneName, cardsInZone]) => {
        zoneCardIds[zoneName] = cardsInZone.map(card => card.id);
      });

      const draftData = {
        type: selectedSpread,
        zoneCards: zoneCardIds,
      };

      console.log('Prepared draft data:', JSON.stringify(draftData, null, 2));

      const spreadNameToUse = (name && name.trim()) || spreadName || (selectedSpread ? SPREADS[selectedSpread].name : 'Untitled Spread');
      const iconName = (selectedSpread && SPREADS[selectedSpread]?.icon?.name) || 'Sparkles';
      const currentTimestamp = new Date().toISOString();
      const spreadZones = selectedSpread ? 
        SPREADS[selectedSpread].zones.map(zone => ({
          name: zone.name, 
          title: zone.title, 
          color: zone.color, 
          description: zone.description 
        })) : [];

      // Prepare the data to save
      const dataToSave = {
        name: spreadNameToUse,
        description: selectedSpread ? SPREADS[selectedSpread].description : '',
        color: selectedSpread ? SPREADS[selectedSpread].color : '#000000',
        icon: iconName,
        user_id: user.id, // Explicitly set user_id
        zones: spreadZones,
        is_draft: true,
        draft_data: draftData,
        last_modified: currentTimestamp
      };
      
      console.log('Data being saved to database:', JSON.stringify(dataToSave, null, 2));
      
      // Log the current RLS context
      const { data: rlsContext } = await supabase.rpc('current_setting', { name: 'role' });
      console.log('Current RLS role:', rlsContext);
      
      // Test RLS with a direct query
      try {
        const { data: testData, error: testError } = await supabase
          .from('spreads')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
          
        console.log('RLS test query result:', { testData, testError });
      } catch (testErr) {
        console.error('RLS test query failed:', testErr);
      }

      let result;
      
      try {
        if (currentSpreadId) {
          // Update existing spread
          console.log('Updating existing spread with ID:', currentSpreadId);
          const updateData = {
            name: spreadNameToUse,
            draft_data: draftData,
            is_draft: true,
            last_modified: currentTimestamp,
          };
          
          console.log('Update data:', JSON.stringify(updateData, null, 2));
          
          const { data, error: updateError } = await supabase
            .from('spreads')
            .update(updateData)
            .eq('id', currentSpreadId)
            .select()
            .single();

          if (updateError) {
            console.error('Update error details:', updateError);
            throw updateError;
          }
          
          console.log('Successfully updated spread:', data);
          result = data;
        } else {
          // Create new spread
          console.log('Creating new spread');
          
          const insertData = {
            name: spreadNameToUse,
            description: selectedSpread ? SPREADS[selectedSpread].description : '',
            color: selectedSpread ? SPREADS[selectedSpread].color : '#000000',
            icon: iconName,
            user_id: user.id, // Explicitly set user_id
            zones: spreadZones,
            is_draft: true,
            draft_data: draftData,
            last_modified: currentTimestamp
          };
          
          console.log('Insert data:', JSON.stringify(insertData, null, 2));
          
          // Try a direct SQL insert as a fallback
          try {
            const { data: newDraft, error: insertError } = await supabase
              .from('spreads')
              .insert(insertData)
              .select()
              .single();

            if (insertError) {
              console.error('Insert error details:', insertError);
              
              // Try with RPC function as fallback
              console.log('Trying with RPC function as fallback...');
              const { data: rpcResult, error: rpcError } = await supabase.rpc('create_spread', {
                p_name: insertData.name,
                p_description: insertData.description,
                p_color: insertData.color,
                p_icon: insertData.icon,
                p_zones: insertData.zones,
                p_draft_data: insertData.draft_data,
                p_user_id: insertData.user_id
              });
              
              if (rpcError) throw rpcError;
              
              console.log('Successfully created spread via RPC:', rpcResult);
              setCurrentSpreadId(rpcResult.id);
              result = rpcResult;
            } else {
              if (!newDraft) throw new Error('No data returned when creating spread');
              
              console.log('Successfully created new spread:', newDraft);
              setCurrentSpreadId(newDraft.id);
              result = newDraft;
            }
          } catch (insertErr) {
            console.error('Error during spread creation:', insertErr);
            throw insertErr;
          }
        }

        if (name && name.trim()) {
          setSpreadName(name.trim());
        }

        // Show success message
        setError('');
        setSuccessMessage('Draft saved successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
        return true;
        
      } catch (dbError: any) {
        console.error('Database error details:', {
          code: dbError.code,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
          error: dbError
        });
        
        // Check if it's an RLS policy error
        if (dbError?.code === '42501') {
          const errorMessage = 'Database permissions error. ';
          const hint = dbError.hint ? `\n\nHint: ${dbError.hint}` : '';
          setError(errorMessage + 'Please contact support or check the console for details.' + hint);
          
          console.error('RLS Policy Error:', dbError.message);
          console.error('Current RLS policies:');
          
          // Log current RLS policies
          const { data: policies } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'spreads');
          console.table(policies);
          
          // Log current user and role
          const { data: userData } = await supabase.auth.getUser();
          console.log('Current auth user:', userData.user?.id);
          
          // Log RLS context
          const { data: rlsContext } = await supabase.rpc('current_setting', { name: 'role' });
          console.log('Current RLS role:', rlsContext);
          
          // Suggest next steps
          console.log('\nNext steps to debug:');
          console.log('1. Check if RLS is enabled on the spreads table');
          console.log('2. Verify the user has the authenticated role');
          console.log('3. Check for any BEFORE INSERT triggers that might be modifying the data');
          
        } else {
          throw dbError;
        }
      }
      
    } catch (err) {
      console.error('Error in saveDraft:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to save draft: ${errorMessage}`);
      return false;
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

  const handleAddCard = (card: any) => {
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

  const renderSpreadOption = (spreadKey: SpreadType) => {
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

  const renderGalleryItem = ({ item }: { item: any }) => (
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
        data={filteredCards}
        renderItem={renderGalleryItem}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.galleryGrid}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        initialNumToRender={8}
        windowSize={5}
        getItemLayout={(data, index) => ({
          length: 200, // Fixed item height
          offset: 200 * Math.floor(index / 2),
          index,
        })}
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
          
          <TextInput
            style={styles.gallerySearchInput}
            placeholder="Search cards"
            placeholderTextColor="#666"
            value={gallerySearchQuery}
            onChangeText={(text) => {
              setGallerySearchQuery(text);
              const filtered = cards.filter((card) => card.name.toLowerCase().includes(text.toLowerCase()));
              setFilteredCards(filtered);
            }}
          />
          
          {renderGalleryContent()}
        </View>
      </View>
    </Modal>
  );

  const renderDropZone = (zone: any) => {
    const Icon = zone.icon;
    const cards = zoneCards[zone.name] || [];
    const isFullscreen = fullscreenZone === zone.name;

    return (
      <View 
        style={[styles.dropZone, isFullscreen && styles.fullscreenDropZone]} 
        key={zone.name}
      >
        <LinearGradient
          colors={[`${zone.color}33`, `${zone.color}11`]}
          style={styles.dropZoneGradient}
        >
          <View style={styles.dropZoneHeader}>
            <View style={styles.headerLeft}>
              <Icon size={16} color={zone.color} />
              <Text style={styles.dropZoneTitle}>{zone.title}</Text>
            </View>
            <View style={styles.headerRight}>
              {isFullscreen && (
                <View style={styles.headerControls}>
                  <View style={styles.columnSelector}>
                    {[1, 2, 3, 4].map(cols => (
                      <TouchableOpacity
                        key={`cols-${cols}`}
                        style={[
                          styles.columnOption,
                          numColumns === cols && styles.activeColumnOption,
                          { backgroundColor: numColumns === cols ? `${zone.color}66` : `${zone.color}33` }
                        ]}
                        onPress={() => changeColumnLayout(cols)}
                      >
                        <Text style={[styles.columnOptionText, numColumns === cols && styles.activeColumnOptionText]}>
                          {cols}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.iconButton, { backgroundColor: `${zone.color}33` }]}
                    onPress={() => setShowFullCardView(!showFullCardView)}
                  >
                    {showFullCardView ? (
                      <EyeOff size={16} color={zone.color} />
                    ) : (
                      <Eye size={16} color={zone.color} />
                    )}
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: `${zone.color}33` }]}
                onPress={() => toggleFullscreen(zone.name)}
              >
                {isFullscreen ? (
                  <Minimize2 size={16} color={zone.color} />
                ) : (
                  <Maximize2 size={16} color={zone.color} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: `${zone.color}33` }]}
                onPress={() => handleShowGallery(zone.name)}
              >
                <Plus size={16} color={zone.color} />
              </TouchableOpacity>
            </View>
          </View>
          {!isFullscreen && <Text style={styles.dropZoneDescription}>{zone.description}</Text>}
          {isFullscreen ? (
            <FlatList
              data={cards}
              numColumns={numColumns}
              key={`grid-${numColumns}`}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={({item: card, index}) => (
                <TouchableOpacity 
                  style={[
                    showFullCardView ? styles.fullCardView : styles.gridCard,
                    showFullCardView ? {
                      width: numColumns === 1 ? '99%' : numColumns === 2 ? '48.5%' : numColumns === 3 ? '32%' : '23.5%',
                      padding: numColumns === 1 ? 6 : numColumns === 2 ? 4 : numColumns === 3 ? 3 : 1,
                      aspectRatio: undefined,
                      height: undefined,
                    } : {
                      width: numColumns === 1 ? '99%' : numColumns === 2 ? '48.5%' : numColumns === 3 ? '32%' : '23.5%',
                      padding: numColumns === 1 ? 4 : numColumns === 2 ? 3 : numColumns === 3 ? 2 : 1
                    }
                  ]}
                  onPress={() => {
                    if (showFullCardView) {
                      // In full card view, single tap selects the card
                      setSelectedCardForFullView(card);
                    } else {
                      // Handle double tap with timeout
                      const now = Date.now();
                      const DOUBLE_TAP_DELAY = 300;
                      
                      if (card.lastTap && (now - card.lastTap) < DOUBLE_TAP_DELAY) {
                        // Double tap detected
                        if (expandedCardId === card.id) {
                          setExpandedCardId(null);
                        } else {
                          setExpandedCardId(card.id);
                        }
                        card.lastTap = 0; // Reset to prevent triple tap issues
                      } else {
                        // First tap
                        card.lastTap = now;
                      }
                    }
                  }}
                >
                  {showFullCardView ? (
                    <View style={[styles.fullCardInner, { borderColor: card.color || '#6366f1' }]}>
                      <Image
                        source={{ uri: card.image_url }}
                        style={[
                          styles.fullCardImage,
                          {
                            height: numColumns === 1 ? 200 : numColumns === 2 ? 150 : numColumns === 3 ? 100 : 70
                          }
                        ]}
                        resizeMode="cover"
                      />
                      <View style={[
                        styles.fullCardContent,
                        {
                          padding: numColumns === 1 ? 12 : numColumns === 2 ? 8 : numColumns === 3 ? 6 : 4
                        }
                      ]}>
                        <Text style={[
                          styles.fullCardName,
                          {
                            fontSize: numColumns === 1 ? 16 : numColumns === 2 ? 13 : numColumns === 3 ? 11 : 9
                          }
                        ]}>
                          {card.name}
                        </Text>
                        <Text style={[
                          styles.fullCardType,
                          {
                            fontSize: numColumns === 1 ? 14 : numColumns === 2 ? 11 : numColumns === 3 ? 9 : 8,
                            marginBottom: numColumns === 1 ? 8 : numColumns === 2 ? 5 : numColumns === 3 ? 3 : 2
                          }
                        ]}>
                          {card.card_type || 'Card'}
                        </Text>
                        <Text style={[
                          styles.fullCardDescription,
                          {
                            fontSize: numColumns === 1 ? 14 : numColumns === 2 ? 11 : numColumns === 3 ? 9 : 8,
                            lineHeight: numColumns === 1 ? 20 : numColumns === 2 ? 15 : numColumns === 3 ? 12 : 10,
                            marginTop: numColumns === 1 ? 4 : numColumns === 2 ? 3 : numColumns === 3 ? 2 : 1
                          }
                        ]}>
                          {card.description || 'No description available'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.gridCardInner}>
                      <Image
                        source={{ uri: card.image_url }}
                        style={styles.gridCardImage}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={[styles.gridCardOverlay, expandedCardId === card.id && styles.expandedCardOverlay]}
                      >
                        <Text 
                          style={[
                            styles.gridCardName, 
                            {
                              fontSize: numColumns === 1 ? 14 : numColumns === 2 ? 12 : numColumns === 3 ? 10 : 9
                            }
                          ]} 
                          numberOfLines={expandedCardId === card.id ? undefined : 1}
                        >
                          {card.name}
                        </Text>
                        
                        {expandedCardId === card.id && (
                          <View style={styles.cardDetails}>
                            <Text style={styles.cardType}>
                              {card.card_type || 'Card'}
                            </Text>
                            <Text style={styles.cardDescription} numberOfLines={4}>
                              {card.description || 'No description available'}
                            </Text>
                          </View>
                        )}
                      </LinearGradient>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.gridContainer}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyGrid}>
                  <Text style={styles.emptyText}>No cards added yet</Text>
                  <TouchableOpacity
                    style={[styles.addCardButton, { backgroundColor: zone.color }]}
                    onPress={() => handleShowGallery(zone.name)}
                  >
                    <Plus size={20} color="#fff" />
                    <Text style={styles.addCardButtonText}>Add Cards</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          ) : (
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
          )}
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
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {successMessage ? (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (!selectedSpread) {
    return (
      <View style={styles.container}>
        {/* Spacer removed for consistent padding across tabs */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Choose a Spread</Text>
          <TouchableOpacity
            style={styles.draftsButton} 
            onPress={() => router.push('/drafts')}
          >
            <FileText size={20} color="#6366f1" />
            <Text style={styles.draftsButtonText}>Drafts</Text> 
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/inbox')} style={styles.draftsButton}> 
            <Mail size={24} color="#fff" />
            <Text style={styles.draftsButtonText}>Inbox</Text> 
          </TouchableOpacity>
        </View>
        <ScrollView 
          style={styles.spreadSelector}
          contentContainerStyle={styles.spreadSelectorContent}
        >
          {Object.keys(SPREADS).map((key) => renderSpreadOption(key as SpreadType))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {fullscreenZone ? (
        <SafeAreaView style={styles.fullscreenContainer}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setFullscreenZone(null)}
            >
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.spreadTitle}>
                {SPREADS[selectedSpread!].zones.find(z => z.name === fullscreenZone)?.title || ''}
              </Text>
            </View>
          </View>
          {renderDropZone(SPREADS[selectedSpread!].zones.find(z => z.name === fullscreenZone)!)}
        </SafeAreaView>
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setSelectedSpread(null)}
            >
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.spreadTitle}>
                {spreadName || SPREADS[selectedSpread!].name}
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

          <ScrollView style={styles.dropZonesScroll} contentContainerStyle={styles.dropZonesScrollContent}>
            <View style={styles.dropZonesContainer}>
              {SPREADS[selectedSpread!].zones.map((zone) => renderDropZone(zone))}
            </View>
          </ScrollView>
        </>
      )}

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
                onPress={async () => {
                  if (!spreadName.trim()) return;
                  
                  try {
                    const success = await saveDraft(spreadName);
                    if (success) {
                      setSuccessMessage('Draft saved successfully!');
                      // Clear success message after 3 seconds
                      setTimeout(() => setSuccessMessage(''), 3000);
                      setShowSaveAs(false);
                    }
                  } catch (err) {
                    console.error('Error in save handler:', err);
                    setError(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }}
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
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
  successContainer: {
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  successText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '500',
  },
  gridContainer: {
    padding: 0,
    flexGrow: 1,
    width: '100%',
  },
  gridCard: {
    padding: 2,
    aspectRatio: 0.714, // Standard trading card ratio (5:7 or width:height = 1:1.4)
  },
  gridCardInner: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  gridCardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
  },
  gridCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 6,
  },
  expandedCardOverlay: {
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDetails: {
    marginTop: 8,
    padding: 4,
  },
  cardType: {
    color: '#6366f1',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 16,
  },
  fullCardView: {
    margin: 2,
  },
  fullCardInner: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fullCardImage: {
    width: '100%',
    height: 200, // This is overridden by inline styles for different column counts
  },
  fullCardContent: {
    padding: 12,
  },
  fullCardName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  fullCardType: {
    color: '#6366f1',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginBottom: 8,
  },
  fullCardDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  gridCardName: {
    color: '#fff',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  emptyGrid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  addCardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginLeft: 8,
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: Platform.OS === 'web' ? 16 : 8,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
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
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 10,
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
    padding: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  savingIndicator: {
    marginLeft: 16,
  },
  saveAsButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    marginLeft: 10,
  },
  dropZonesScroll: {
    flex: 1,
  },
  dropZonesScrollContent: {
    flexGrow: 1,
    paddingBottom: 16, // Add some padding at the bottom for better scrolling experience
  },
  dropZonesContainer: {
    gap: 12,
  },
  dropZone: {
    minHeight: SCREEN_HEIGHT / 3 - 20, // Changed from fixed height to minHeight
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  fullscreenDropZone: {
    flex: 1,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  fullscreenContainer: {
    flex: 1,
  },
  dropZoneGradient: {
    flex: 1,
    padding: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropZoneTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginLeft: 8,
  },
  iconButton: {
    padding: 4,
    borderRadius: 4,
  },
  addButton: {
    padding: 4,
    borderRadius: 4,
  },
  columnSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 4,
    padding: 2,
  },
  columnOption: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
    marginHorizontal: 2,
  },
  activeColumnOption: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  columnOptionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  activeColumnOptionText: {
    color: '#fff',
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
    padding: 6,
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
    marginTop: hasDynamicIsland() ? 60 : 40, // Reduced margin for Dynamic Island
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
    padding: 10,
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
    padding: 6,
    borderRadius: 6,
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
    padding: 6,
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
    padding: 8,
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
  gallerySearchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    marginBottom: 20,
    width: '100%',
  },
});