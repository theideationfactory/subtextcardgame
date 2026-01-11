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
  Pressable,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
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
  Send, // Added for Send button
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Spacer } from '@/components/Spacer';
import { hasDynamicIsland } from '@/utils/deviceDimensions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log, logError } from '@/utils/logger';

// Define the types for our data structures
interface Card {
  id: string;
  name: string;
  description: string;
  image_url: string;
  is_premium_generation?: boolean;
  card_type?: string;
  color?: string;
}

interface Spread {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  user_id: string;
  zones: any[]; // Consider defining a proper type for zones
  is_draft: boolean;
  draft_data: any; // Consider defining a proper type for draft_data
  last_modified: string;
}

interface CustomSpreadZone {
  id: string;
  name: string;
  title: string;
  description: string;
  color: string;
  icon: string;
}

interface CustomSpread {
  name: string;
  description: string;
  color: string;
  zones: CustomSpreadZone[];
}

// Use shared authenticated Supabase client from lib to ensure RLS uses the active session

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
        name: 'context',
        title: 'Context',
        color: '#FF9800',
        icon: Book,
        description: 'Events and circumstances that inform your perspective',
      },
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
  const [phenomenaTypes, setPhenomenaTypes] = useState<string[]>(['All']);
  const [selectedPhenomena, setSelectedPhenomena] = useState<string>('All');
  const [showPhenomenaMenu, setShowPhenomenaMenu] = useState(false);
  const [activeScope, setActiveScope] = useState('Personal');
  const [filteredCards, setFilteredCards] = useState<any[]>([]);
  const [showFullCardView, setShowFullCardView] = useState(false);
  const [selectedCardForFullView, setSelectedCardForFullView] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [cardToRemove, setCardToRemove] = useState<{card: any, zone: string} | null>(null);
  const [autoAddCardData, setAutoAddCardData] = useState<string | null>(null);
  const [autoAddZone, setAutoAddZone] = useState<string | null>(null);
  const [wordsRemembered, setWordsRemembered] = useState<Record<string, string>>({});
  const [customSpread, setCustomSpread] = useState<CustomSpread | null>(null);
  const [savedCustomSpreads, setSavedCustomSpreads] = useState<any[]>([]);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  // Handle auto-adding a card when returning from create screen
  // This effect handles the auto-add card data passed from the creation screen
  useEffect(() => {
    if (params.autoAddCardData && params.autoAddZone) {
      const cardData = Array.isArray(params.autoAddCardData) ? params.autoAddCardData[0] : params.autoAddCardData;
      const zone = Array.isArray(params.autoAddZone) ? params.autoAddZone[0] : params.autoAddZone;
      
      setAutoAddCardData(cardData);
      setAutoAddZone(zone);
      
      // Clear the params to prevent re-adding on re-render
      router.setParams({});
    }
  }, [params.autoAddCardData, params.autoAddZone]);
  
  // This effect adds the card from the parsed data directly to the zone
  useEffect(() => {
    if (autoAddCardData && autoAddZone) {
      try {
        const cardToAdd = JSON.parse(autoAddCardData);
        log('Successfully parsed card to add:', cardToAdd.name);

        setZoneCards(prev => ({
          ...prev,
          [autoAddZone]: [...(prev[autoAddZone] || []), cardToAdd]
        }));

        setSuccessMessage('Card added to spread!');
        setTimeout(() => setSuccessMessage(''), 3000);

        // Reset state after adding the card
        setAutoAddCardData(null);
        setAutoAddZone(null);

      } catch (error) {
        logError('Failed to parse auto-add card data:', error);
        // Clear state even if parsing fails to prevent retries
        setAutoAddCardData(null);
        setAutoAddZone(null);
      }
    }
  }, [autoAddCardData, autoAddZone]);

  // Handle custom spread data from custom spread builder
  useEffect(() => {
    const handleCustomSpreadData = async () => {
      const customSpreadParam = Array.isArray(params.customSpread) ? params.customSpread[0] : params.customSpread;
      if (customSpreadParam && customSpreadParam !== 'undefined' && customSpreadParam.trim() !== '') {
        try {
          const decodedData = decodeURIComponent(customSpreadParam);
          const customSpreadData = JSON.parse(decodedData);
          setCustomSpread(customSpreadData);
          setSelectedSpread(null); // Custom spreads don't use predefined spread types
          setSpreadName(customSpreadData.name);
          
          // Initialize zone cards for custom spread
          const initialZoneCards: Record<string, any[]> = {};
          customSpreadData.zones.forEach((zone: CustomSpreadZone) => {
            initialZoneCards[zone.name] = [];
          });
          setZoneCards(initialZoneCards);
          
          // Refresh saved custom spreads to show the newly created one
          await loadSavedCustomSpreads();
          
          // Clear params to prevent re-processing by navigating without the parameter
          router.replace('/(tabs)/spread');
        } catch (error) {
          logError('Error parsing custom spread data:', error);
          logError('Raw params.customSpread:', params.customSpread);
          logError('Type of params.customSpread:', typeof params.customSpread);
          setError('Failed to load custom spread data. Please try creating the spread again.');
        }
      }
    };

    handleCustomSpreadData();
  }, [params.customSpread]);

  const loadSavedCustomSpreads = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('custom_spread_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setSavedCustomSpreads(data || []);
    } catch (error) {
      logError('Error loading saved custom spreads:', error);
    }
  };

  useEffect(() => {
    const initializeScreen = async () => {
      try {
        setLoading(true);
        // Fetch all cards initially to populate the base `cards` state
        await fetchCards();
        // Load saved custom spreads
        await loadSavedCustomSpreads();
      } catch (err) {
        logError('Error initializing screen:', err);
        setError('Failed to initialize screen');
      } finally {
        setLoading(false);
      }
    };

    initializeScreen();
  }, [user]); // Run only once on mount

  // This effect reacts to gallery visibility and scope changes to fetch the correct cards.
  // Load phenomena types when gallery opens
  useEffect(() => {
    const loadPhenomenaTypes = async () => {
      try {
        const stored = await AsyncStorage.getItem('@phenomena_types');
        if (stored) {
          const parsed = JSON.parse(stored);
          setPhenomenaTypes(['All', ...parsed]);
        }
      } catch (err) {
        logError('Error loading phenomena types:', err);
      }
    };

    if (showGallery) {
      loadPhenomenaTypes();
      setGalleryLoading(true);
      fetchCards(0, 100, false, activeScope)
        .then(scopedCards => {
          // Apply initial phenomena filter
          const initiallyFiltered = scopedCards.filter(card =>
            (selectedPhenomena === 'All' || card.type === selectedPhenomena)
          );
          setFilteredCards(initiallyFiltered);
          setGalleryLoading(false);
        })
        .catch(err => {
          logError('Error fetching scoped cards:', err);
          setError('Failed to load cards for this view.');
          setGalleryLoading(false);
        });
    }
  }, [showGallery, activeScope]);

  // Refresh cards when screen comes into focus (e.g., returning from card creation)
  useFocusEffect(
    useCallback(() => {
      // Only refresh if we have auto-add parameters or if cards might be stale
      if (params.autoAddCard || params.autoAddZone) {
        log('Refreshing cards due to auto-add parameters');
        fetchCards();
      }
    }, [params.autoAddCard, params.autoAddZone, fetchCards])
  );

  useEffect(() => {
    const loadDraftIfNeeded = async () => {
      if (params.draftId) {
        const draftIdToLoad = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId;
        if (draftIdToLoad && draftIdToLoad !== currentSpreadId) { // Only load if it's a different draft
          try {
            // Ensure all cards are available before loading a draft
            if (!cards || cards.length === 0) {
              await fetchCards();
            }
            await loadDraft(draftIdToLoad);
          } catch (err) {
            logError('Error loading draft:', err);
            setError('Failed to load draft. Please try again.');
          }
        }
      }
    };

    loadDraftIfNeeded();
  }, [params.draftId, currentSpreadId]); // Corrected dependencies

  const handleShowGallery = useCallback((zoneName: string) => {
    setActiveZone(zoneName);
    setShowGallery(true);
    setGallerySearchQuery(''); // Reset search query
  }, []);

  // Update filteredCards when cards change and gallery is open
  useEffect(() => {
    if (showGallery) {
      setFilteredCards(prev => {
        // Only update if there's an actual change in cards
        const cardIds = new Set(cards.map(card => card.id));
        const prevIds = new Set(prev.map(card => card.id));
        const hasChanges = cards.length !== prev.length || 
                         cards.some(card => !prevIds.has(card.id)) ||
                         prev.some(card => !cardIds.has(card.id));
        return hasChanges ? [...cards] : prev;
      });
    }
  }, [cards, showGallery]);

  // Update filtered cards when selectedPhenomena changes
  useEffect(() => {
    if (showGallery) {
      const filtered = cards.filter(card => {
        const matchesSearch = card.name.toLowerCase().includes(gallerySearchQuery.toLowerCase());
        const matchesPhenomena = selectedPhenomena === 'All' || card.type === selectedPhenomena;
        return matchesSearch && matchesPhenomena;
      });
      setFilteredCards(filtered);
    }
  }, [selectedPhenomena]);

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
      logError('Error checking for existing draft:', err);
      setError('Failed to check for existing draft');
    }
  };

  const loadDraft = async (draftId: string) => {
    try {
      log('Loading draft with ID:', draftId);
      
      // Ensure cards are loaded first
      let currentCards = cards;
      if (!currentCards || currentCards.length === 0) {
        log('Cards not loaded, fetching cards first...');
        currentCards = await fetchCards(0, 1000, false); // Capture the returned cards, ensure no cache, fetch a larger limit
      }

      const { data: draft, error: draftError } = await supabase
        .from('spreads')
        .select('*')
        .eq('id', draftId)
        .single();

      if (draftError) {
        logError('Error fetching draft:', draftError);
        throw draftError;
      }

      if (!draft) {
        logError('No draft found with ID:', draftId);
        setError('Draft not found or you may not have access to it.');
        return;
      }

      log('Draft loaded successfully:', draft);
    if (draft?.draft_data?.zoneCards) {
      log('Card IDs in shared draft zoneCards:', JSON.stringify(draft.draft_data.zoneCards));
    }

      if (draft?.draft_data) {
        if (draft.draft_data.wordsRemembered) {
          setWordsRemembered(draft.draft_data.wordsRemembered);
        }
        log('Setting spread type to:', draft.draft_data.type);
        
        // Handle custom spreads vs predefined spreads
        if (draft.draft_data.type === 'custom' && draft.draft_data.customSpread) {
          // This is a custom spread
          setCustomSpread(draft.draft_data.customSpread);
          setSelectedSpread(null);
          setSpreadName(draft.name || draft.draft_data.customSpread.name);
        } else {
          // This is a predefined spread
          setCustomSpread(null);
          setSelectedSpread(draft.draft_data.type as SpreadType);
          setSpreadName(draft.name || SPREADS[draft.draft_data.type as SpreadType].name);
        }
        
        setCurrentSpreadId(draft.id);

        // Fetch cards specifically linked to this spread so recipients can see them
        const { data: spreadCards, error: spreadCardsError } = await supabase
          .from('cards')
          .select('*')
          .eq('spread_id', draft.id);

        if (spreadCardsError) {
          logError('Error fetching cards for spread:', spreadCardsError);
        }

        // Build a fresh map from spread-scoped cards, with a fallback to currentCards
        const cardsById: Record<string, any> = {};
        (spreadCards || []).forEach(card => {
          cardsById[card.id] = card;
        });
        if ((!spreadCards || spreadCards.length === 0) && currentCards && currentCards.length > 0) {
          // Fallback: use existing cards list
          currentCards.forEach(card => {
            cardsById[card.id] = card;
          });
        }
        log('Available card IDs in cardMap:', Object.keys(cardsById));
        setCardMap(cardsById);

        const restoredZoneCards: Record<string, any[]> = {};
        Object.entries(draft.draft_data.zoneCards).forEach(([zoneName, cardIds]: [string, any]) => {
          log(`Processing zone ${zoneName} with card IDs:`, cardIds);
          
          const zoneCards = (cardIds as string[]).map((id: string) => {
            const card = cardsById[id];
            if (!card) {
              logError(`Card ${id} not found in cardsById map for zone ${zoneName}`);
            }
            return card;
          }).filter(Boolean);
          
          restoredZoneCards[zoneName] = zoneCards;
          log(`Zone ${zoneName} restored with ${zoneCards.length} of ${cardIds.length} cards`);
        });
        
        setZoneCards(restoredZoneCards);
        log('Draft state restored successfully');
      } else {
        logError('Invalid draft data structure:', draft);
        setError('Invalid draft data. The draft may be corrupted.');
      }
    } catch (err) {
      logError('Error loading draft:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load draft. Please try again.';
      setError(errorMessage);
    }
  };

  const saveDraft = async (name?: string) => {
    if (!selectedSpread && !customSpread) {
      logError('No spread selected');
      return false;
    }

    try {
      setSavingDraft(true);
      
      // Check if user is authenticated using AuthContext
      if (!user || !user.id) {
        logError('No authenticated user from AuthContext');
        const error = new Error('No authenticated user');
        logError('Auth error details:', { user, hasId: user?.id ? 'yes' : 'no' });
        throw error;
      }
      
      log('Saving draft for user:', user.id);
      
      // Prepare zone cards data
      const zoneCardIds: Record<string, string[]> = {};
      Object.entries(zoneCards).forEach(([zoneName, cardsInZone]) => {
        zoneCardIds[zoneName] = cardsInZone.map(card => card.id);
      });

      const draftData = {
        type: selectedSpread || 'custom',
        zoneCards: zoneCardIds,
        wordsRemembered,
        ...(customSpread && { customSpread }), // Include custom spread data if it exists
      };

      log('Prepared draft data:', JSON.stringify(draftData, null, 2));

      const spreadNameToUse = (name && name.trim()) || spreadName || (selectedSpread ? SPREADS[selectedSpread].name : customSpread?.name || 'Untitled Spread');
      const iconName = (selectedSpread && SPREADS[selectedSpread]?.icon?.name) || 'Sparkles';
      const currentTimestamp = new Date().toISOString();
      const spreadZones = selectedSpread ? 
        SPREADS[selectedSpread].zones.map(zone => ({
          name: zone.name, 
          title: zone.title, 
          color: zone.color, 
          description: zone.description 
        })) : 
        customSpread ? customSpread.zones.map(zone => ({
          name: zone.name,
          title: zone.title,
          color: zone.color,
          description: zone.description
        })) : [];

      // Prepare the data to save
      const dataToSave = {
        name: spreadNameToUse,
        description: selectedSpread ? SPREADS[selectedSpread].description : (customSpread?.description || ''),
        color: selectedSpread ? SPREADS[selectedSpread].color : (customSpread?.color || '#000000'),
        icon: iconName,
        user_id: user.id, // Explicitly set user_id
        zones: spreadZones,
        is_draft: true,
        draft_data: draftData,
        last_modified: currentTimestamp
      };
      
      log('Data being saved to database:', JSON.stringify(dataToSave, null, 2));
      
      let result: Spread | null = null;
      
      try {
        if (currentSpreadId) {
          // Update existing spread
          log('Updating existing spread with ID:', currentSpreadId);
          const updateData = {
            name: spreadNameToUse,
            draft_data: draftData,
            is_draft: true,
            last_modified: currentTimestamp,
          };
          
          log('Update data:', JSON.stringify(updateData, null, 2));
          
          const { data, error: updateError } = await supabase
            .from('spreads')
            .update(updateData)
            .eq('id', currentSpreadId)
            .select()
            .single();

          if (updateError) {
            logError('Update error details:', updateError);
            throw updateError;
          }
          
          log('Successfully updated spread:', data);
          result = data;
        } else {
          // Create new spread
          log('Creating new spread');
          
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
          
          log('Insert data:', JSON.stringify(insertData, null, 2));
          
          // Try a direct SQL insert as a fallback
          try {
            const { data: newDraft, error: insertError } = await supabase
              .from('spreads')
              .insert(insertData)
              .select()
              .single();

            if (insertError) {
              logError('Insert error details:', insertError);
              
              // Try with RPC function as fallback
              log('Trying with RPC function as fallback...');
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
              
              log('Successfully created spread via RPC:', rpcResult);
              setCurrentSpreadId(rpcResult.id);
              result = rpcResult;
            } else {
              if (!newDraft) throw new Error('No data returned when creating spread');
              
              log('Successfully created new spread:', newDraft);
              setCurrentSpreadId(newDraft.id);
              result = newDraft;
            }
          } catch (insertErr) {
            logError('Error during spread creation:', insertErr);
            throw insertErr;
          }
        }

        // Update spread_id for all cards in the spread after successful save
        if (result) {
          const spreadId = result.id;
          const allCardIds = Object.values(zoneCardIds).flat();
          if (allCardIds.length > 0) {
            log(`Linking ${allCardIds.length} cards to spread ${spreadId}`);
            
            const linkPromises = allCardIds.map(cardId =>
              supabase.rpc('link_card_to_spread', {
                card_id_to_link: cardId,
                target_spread_id: spreadId,
              })
            );
            
            const results = await Promise.allSettled(linkPromises);
            
            results.forEach((promiseResult, index) => {
              if (promiseResult.status === 'rejected') {
                logError(`Error linking card ${allCardIds[index]} to spread:`, promiseResult.reason);
              } else if (promiseResult.value.error) {
                logError(`Error linking card ${allCardIds[index]} to spread:`, promiseResult.value.error);
              }
            });
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
        logError('Database error details:', {
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
          
          logError('RLS Policy Error:', dbError.message);
          logError('Current RLS policies:');
          
          // Log current RLS policies
          const { data: policies } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'spreads');
          console.table(policies);
          
          // Log current user and role
          log('Current auth user:', user.id);
          
          // Log RLS context
          const { data: rlsContext } = await supabase.rpc('current_setting', { name: 'role' });
          log('Current RLS role:', rlsContext);
          
          // Suggest next steps
          log('\nNext steps to debug:');
          log('1. Check if RLS is enabled on the spreads table');
          log('2. Verify the user has the authenticated role');
          log('3. Check for any BEFORE INSERT triggers that might be modifying the data');
          
        } else {
          throw dbError;
        }
      }
      
    } catch (err) {
      logError('Error in saveDraft:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to save draft: ${errorMessage}`);
      return false;
    } finally {
      setSavingDraft(false);
      setShowSaveAs(false);
    }
  };

  const resetSpreadTitle = () => {
    if (!selectedSpread) return;
    
    // Clear local UI state
    const defaultName = SPREADS[selectedSpread].name;
    setSpreadName(defaultName);
    setZoneCards({}); // Clear all cards from zones
    setCurrentSpreadId(null); // Sever link to any previously saved draft
    setError(''); // Clear any previous errors
    // Do NOT update the database here. The user is starting fresh locally.
  };

  const handleAddCard = async (card: any) => {
    if (!activeZone) return;
    
    // Update local state first
    setZoneCards(prev => ({
      ...prev,
      [activeZone]: [...(prev[activeZone] || []), card],
    }));
    
    // Use the new RPC to link the card to the spread
    if (currentSpreadId) {
      const { error } = await supabase.rpc('link_card_to_spread', {
        card_id_to_link: card.id,
        target_spread_id: currentSpreadId,
      });

      if (error) {
        logError('Error linking card to spread:', error);
        // Don't throw error - the UI update already happened and this is a background operation
      }
    }
    
    setShowGallery(false);
    setActiveZone(null);
  };

  const handleCreateCard = () => {
    const currentZone = activeZone;
    setShowGallery(false);
    router.push({
      pathname: '/create',
      params: { returnTo: 'spread', zone: currentZone }
    });
  };

  const handleCreateCardFromGallery = () => {
    const currentZone = activeZone;
    setShowGallery(false); // Close the modal
    router.push({
      pathname: '/(tabs)/card-creation-new',
      params: { returnTo: 'spread', zone: currentZone }
    });
  };

  const removeCardFromZone = async (cardId: string, zoneName: string) => {
    // Update local state first
    setZoneCards(prev => {
      const newZoneCards = { ...prev };
      if (newZoneCards[zoneName]) {
        newZoneCards[zoneName] = newZoneCards[zoneName].filter(card => card.id !== cardId);
      }
      return newZoneCards;
    });
    
    // Use the new RPC to unlink the card from the spread
    const { error } = await supabase.rpc('unlink_card_from_spread', {
      card_id_to_unlink: cardId,
    });

    if (error) {
      logError('Error unlinking card from spread:', error);
      // Don't throw error - UI update already happened
    }
    
    setCardToRemove(null);
  };

  const handleCardPress = (card: any, zoneName: string) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (card.lastTap && (now - card.lastTap) < DOUBLE_TAP_DELAY) {
      // Double tap detected - show remove confirmation
      setCardToRemove({ card, zone: zoneName });
      card.lastTap = 0; // Reset to prevent triple tap issues
    } else {
      // First tap - handle single tap behavior
      card.lastTap = now;
      
      // Existing single tap behavior
      if (showFullCardView) {
        setSelectedCardForFullView(card);
      } else {
        if (expandedCardId === card.id) {
          setExpandedCardId(null);
        } else {
          setExpandedCardId(card.id);
        }
      }
    }
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

  const handleCustomSpreadSelect = (customSpreadTemplate: any) => {
    // Convert template to CustomSpread format
    const customSpreadData: CustomSpread = {
      name: customSpreadTemplate.name,
      description: customSpreadTemplate.description,
      color: customSpreadTemplate.color,
      zones: customSpreadTemplate.zones
    };

    setCustomSpread(customSpreadData);
    setSelectedSpread(null);
    setSpreadName(customSpreadData.name);

    // Initialize zone cards for custom spread
    const initialZoneCards: Record<string, any[]> = {};
    customSpreadData.zones.forEach((zone: CustomSpreadZone) => {
      initialZoneCards[zone.name] = [];
    });
    setZoneCards(initialZoneCards);
  };

  const renderCustomSpreadOption = (customSpreadTemplate: any) => {
    const IconComponent = getIconComponent(customSpreadTemplate.zones[0]?.icon || 'Target');

    return (
      <TouchableOpacity
        key={customSpreadTemplate.id}
        style={styles.spreadOption}
        onPress={() => handleCustomSpreadSelect(customSpreadTemplate)}
      >
        <LinearGradient
          colors={[`${customSpreadTemplate.color}33`, `${customSpreadTemplate.color}11`]}
          style={styles.spreadOptionGradient}
        >
          <View style={styles.customSpreadHeader}>
            <IconComponent size={24} color={customSpreadTemplate.color} />
            <View style={styles.customSpreadBadge}>
              <Text style={styles.customSpreadBadgeText}>Custom</Text>
            </View>
          </View>
          <Text style={styles.spreadOptionTitle}>{customSpreadTemplate.name}</Text>
          <Text style={styles.spreadOptionDescription}>{customSpreadTemplate.description}</Text>
          <Text style={styles.customSpreadZoneCount}>
            {customSpreadTemplate.zones.length} zones
          </Text>
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
        resizeMode={item.is_premium_generation ? "contain" : "cover"}
      />
      {/* Hide name overlay for premium generation cards */}
      {!item.is_premium_generation && (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.galleryItemOverlay}
        >
          <Text style={styles.galleryItemName} numberOfLines={2}>
            {item.name}
          </Text>
        </LinearGradient>
      )}
    </TouchableOpacity>
  );

  const renderGalleryContent = () => {
    // This will be used later to filter cards based on the active tab
    const cardsForScope = filteredCards; // For now, just use all filtered cards

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
            onPress={handleCreateCardFromGallery}
          >
            <PlusCircle size={20} color="#fff" style={styles.createCardIcon} />
            <Text style={styles.createCardText}>Create New Card</Text>
          </TouchableOpacity>
          
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeScope === 'Personal' && styles.activeTab]}
                onPress={() => setActiveScope('Personal')}
              >
                <Text style={[styles.tabText, activeScope === 'Personal' && styles.activeTabText]}>Personal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeScope === 'Friends' && styles.activeTab]}
                onPress={() => setActiveScope('Friends')}
              >
                <Text style={[styles.tabText, activeScope === 'Friends' && styles.activeTabText]}>Friends</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeScope === 'Public' && styles.activeTab]}
                onPress={() => setActiveScope('Public')}
              >
                <Text style={[styles.tabText, activeScope === 'Public' && styles.activeTabText]}>Public</Text>
              </TouchableOpacity>
            </View>

            {/* Phenomena (Deck) Dropdown */}
            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowPhenomenaMenu(prev => !prev)}
              >
                <Text style={styles.dropdownButtonText}>{selectedPhenomena}</Text>
              </TouchableOpacity>
              {showPhenomenaMenu && (
                <View style={styles.dropdownMenu}>
                  {phenomenaTypes.map(type => (
                    <TouchableOpacity
                      key={type}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedPhenomena(type);
                        setShowPhenomenaMenu(false);

                        const filtered = cards.filter(card => {
                          const matchesSearch = card.name.toLowerCase().includes(gallerySearchQuery.toLowerCase());
                          const matchesPhenomena = type === 'All' || card.type === type;
                          return matchesSearch && matchesPhenomena;
                        });
                        setFilteredCards(filtered);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <TextInput
              style={styles.gallerySearchInput}
              placeholder="Search cards"
              placeholderTextColor="#666"
              value={gallerySearchQuery}
              onChangeText={(text) => {
                setGallerySearchQuery(text);
                const filtered = cards.filter(card => {
                  const matchesSearch = card.name.toLowerCase().includes(text.toLowerCase());
                  const matchesPhenomena = selectedPhenomena === 'All' || card.type === selectedPhenomena;
                  return matchesSearch && matchesPhenomena;
                });
                setFilteredCards(filtered);
              }}
            />
          </View>

          {renderGalleryContent()}
        </View>
      </View>
    </Modal>
  );

  // Icon mapping for custom spreads
  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, any> = {
      Target,
      Shield,
      Book,
      Heart,
      MessageCircle,
      Lightbulb,
      Users,
      Sparkles,
    };
    return iconMap[iconName] || Target;
  };

  const renderDropZone = (zone: any) => {
    const Icon = typeof zone.icon === 'string' ? getIconComponent(zone.icon) : zone.icon;
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
              <Pressable style={styles.addButton} onPress={() => handleAddCard(zone.id)}>
                <Plus size={16} color={zone.color} />
              </Pressable>
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
                  onPress={() => handleCardPress(card, zone.name)}
                >
                  {showFullCardView ? (
                    <View style={[
                      styles.fullCardInner, 
                      { 
                        borderColor: card.color || '#6366f1',
                        backgroundColor: card.is_premium_generation ? '#000000' : '#1a1a1a'
                      }
                    ]}>
                      <Image
                        source={{ uri: card.image_url }}
                        style={[
                          styles.fullCardImage,
                          {
                            height: numColumns === 1 ? 200 : numColumns === 2 ? 150 : numColumns === 3 ? 100 : 70
                          }
                        ]}
                        resizeMode={card.is_premium_generation ? "contain" : "cover"}
                      />
                      {/* Hide text content for premium generation cards */}
                      {!card.is_premium_generation && (
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
                      )}
                    </View>
                  ) : (
                    <View style={[
                      styles.gridCardInner,
                      card.is_premium_generation && { backgroundColor: '#000000' }
                    ]}>
                      <Image
                        source={{ uri: card.image_url }}
                        style={styles.gridCardImage}
                        resizeMode={card.is_premium_generation ? "contain" : "cover"}
                      />
                      {/* Hide name overlay for premium generation cards */}
                      {!card.is_premium_generation && (
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
                      )}
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
                <TouchableOpacity 
                  key={`${card.id}-${index}`} 
                  style={[
                    styles.miniCard,
                    card.is_premium_generation && { backgroundColor: '#000000' }
                  ]}
                  onPress={() => handleCardPress(card, zone.name)}
                >
                  <Image
                    source={{ uri: card.image_url }}
                    style={styles.miniCardImage}
                    resizeMode={card.is_premium_generation ? "contain" : "cover"}
                  />
                  {/* Hide name overlay for premium generation cards */}
                  {!card.is_premium_generation && (
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.8)']}
                      style={styles.miniCardOverlay}
                    >
                      <Text style={styles.miniCardName} numberOfLines={1}>
                        {card.name}
                      </Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <View style={styles.wordsRememberedContainer}>
            <TextInput
              style={styles.wordsRememberedInput}
              placeholder="Words Remembered..."
              placeholderTextColor="#999"
              value={wordsRemembered[zone.name]}
              onChangeText={(text) => setWordsRemembered(prev => ({ ...prev, [zone.name]: text }))}
              multiline
            />
          </View>
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

  if (!selectedSpread && !customSpread) {
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
          <TouchableOpacity onPress={() => router.push('/inbox')} style={styles.draftsButton}> 
            <Mail size={24} color="#fff" />
            <Text style={styles.draftsButtonText}>Inbox</Text> 
          </TouchableOpacity>
        </View>
        <ScrollView 
          style={styles.spreadSelector}
          contentContainerStyle={styles.spreadSelectorContent}
        >
          {/* Default Spreads */}
          {Object.keys(SPREADS).map((key) => renderSpreadOption(key as SpreadType))}
          
          {/* Saved Custom Spreads */}
          {savedCustomSpreads.length > 0 && (
            <>
              <View style={styles.sectionDivider}>
                <Text style={styles.sectionTitle}>My Custom Spreads</Text>
              </View>
              {savedCustomSpreads.map((customSpreadTemplate) => renderCustomSpreadOption(customSpreadTemplate))}
            </>
          )}
          
          {/* Custom Spread Builder Button */}
          <TouchableOpacity
            style={styles.customSpreadOption}
            onPress={() => router.push('/(tabs)/custom-spread-builder')}
          >
            <LinearGradient
              colors={['#6366f133', '#6366f111']}
              style={styles.customSpreadGradient}
            >
              <Plus size={32} color="#6366f1" />
              <Text style={styles.customSpreadTitle}>Create Custom Spread</Text>
              <Text style={styles.customSpreadDescription}>
                Design your own spread with custom zones and prompts
              </Text>
            </LinearGradient>
          </TouchableOpacity>
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
                {customSpread ? 
                  customSpread.zones.find(z => z.name === fullscreenZone)?.title || '' :
                  SPREADS[selectedSpread!].zones.find(z => z.name === fullscreenZone)?.title || ''
                }
              </Text>
            </View>
          </View>
          {renderDropZone(
            customSpread ? 
              customSpread.zones.find(z => z.name === fullscreenZone)! :
              SPREADS[selectedSpread!].zones.find(z => z.name === fullscreenZone)!
          )}
        </SafeAreaView>
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setSelectedSpread(null);
                setCustomSpread(null);
                setCurrentSpreadId(null);
                setZoneCards({});
                setSpreadName('');
                setError('');
                // Navigate to spread screen without draftId parameter to clear URL state
                router.replace('/(tabs)/spread');
              }}
            >
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.spreadTitle}>
                {spreadName || (selectedSpread ? SPREADS[selectedSpread].name : customSpread?.name || 'Custom Spread')}
              </Text>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetSpreadTitle}
              >
                <RotateCcw size={16} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.headerActions}>
              {savingDraft && (
                <ActivityIndicator size="small" color="#6366f1" style={styles.savingIndicator} />
              )}
              <TouchableOpacity
                style={[styles.iconButton, styles.saveAsButton]}
                onPress={() => setShowSaveAs(true)}
              >
                <Save size={20} color="#6366f1" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, styles.sendButton]}
                onPress={() => {
                  // Send functionality will be added later
                  log('Send button pressed');
                }}
              >
                <Send size={24} color="#6366f1" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.dropZonesScroll} contentContainerStyle={styles.dropZonesScrollContent}>
            <View style={styles.dropZonesContainer}>
              {customSpread ? 
                customSpread.zones.map((zone) => renderDropZone(zone)) :
                SPREADS[selectedSpread!].zones.map((zone) => renderDropZone(zone))
              }
            </View>
          </ScrollView>
        </>
      )}

      {renderGalleryModal()}

      {/* Simple Remove Card Confirmation */}
      <Modal
        visible={!!cardToRemove}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCardToRemove(null)}
      >
        <TouchableOpacity 
          style={styles.simpleModalOverlay}
          activeOpacity={1}
          onPress={() => setCardToRemove(null)}
        >
          <View style={styles.simpleModalContent}>
            <Text style={styles.simpleModalText}>Remove card?</Text>
            <View style={styles.simpleModalButtons}>
              <TouchableOpacity
                style={styles.simpleModalButton}
                onPress={() => setCardToRemove(null)}
              >
                <Text style={styles.simpleModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <View style={styles.simpleModalDivider} />
              <TouchableOpacity
                style={[styles.simpleModalButton, styles.simpleModalButtonDanger]}
                onPress={() => cardToRemove && removeCardFromZone(cardToRemove.card.id, cardToRemove.zone)}
              >
                <Text style={[styles.simpleModalButtonText, styles.simpleModalButtonDangerText]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

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
                    logError('Error in save handler:', err);
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
  // Simple Remove Confirmation Styles
  simpleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  simpleModalContent: {
    backgroundColor: '#2a2a3a',
    borderRadius: 14,
    width: 280,
    overflow: 'hidden',
  },
  simpleModalText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    padding: 24,
    fontFamily: 'Inter-Regular',
  },
  simpleModalButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  simpleModalButton: {
    flex: 1,
    minHeight: 150, // Minimum height for the drop zone
  },
  wordsRememberedContainer: {
    padding: 10,
    backgroundColor: '#222',
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  wordsRememberedInput: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 10,
    borderRadius: 5,
    textAlignVertical: 'top',
  },
  simpleModalButtonText: {
    color: '#0a84ff',
    fontSize: 16,
    fontWeight: '600',
  },
  simpleModalButtonDanger: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.1)',
  },
  simpleModalButtonDangerText: {
    color: '#ff453a',
  },
  simpleModalDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    paddingHorizontal: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    width: '100%',
  },
  pageTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    flex: 1,
    marginRight: 8,
  },
  draftsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginLeft: 8,
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
  customSpreadOption: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    marginTop: 8,
  },
  customSpreadGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  customSpreadTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter-Bold',
  },
  customSpreadDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  sectionDivider: {
    marginVertical: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
  },
  customSpreadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  customSpreadBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  customSpreadBadgeText: {
    color: '#6366f1',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  customSpreadZoneCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginTop: 4,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  saveAsButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    marginLeft: 8,
  },
  sendButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    marginLeft: 8,
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
    width: 100,
    height: 140,
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
  dropdownButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownButtonText: {
    color: '#fff',
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 2000,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dropdownItemText: {
    color: '#fff',
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  gallerySearchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    marginTop: 16,
    width: '100%',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  activeTabText: {
    color: '#fff',
  },
});