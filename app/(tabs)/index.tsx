import { View, Text, TextInput, StyleSheet, FlatList, Pressable, Image, Modal, TouchableOpacity, RefreshControl, useWindowDimensions, Platform, PlatformIOSStatic, Dimensions, Alert, Animated, Linking } from 'react-native';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { Cinzel_400Regular } from '@expo-google-fonts/cinzel';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter, useFocusEffect } from 'expo-router';
import { Settings2, CreditCard as Edit3, Trash2, Swords, Shield, Sparkles, Users, Globe as Globe2, Lock, Wallet, Plus, Share2, Coins, Heart, Globe, Star, Wand2, Zap, Target, User, Briefcase, Palette, Upload, X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Spacer } from '@/components/Spacer';
import { isIPad, isTablet, isIPadMini } from '@/utils/deviceDimensions';
import GuestModeBanner from '@/components/GuestModeBanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { log, logError } from '@/utils/logger';
// NFT minting now handled server-side via Edge Function

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
  const { user, isAnonymous } = useAuth();
  const insets = useSafeAreaInsets();
  // Define Card type to fix TypeScript errors
  type Card = {
    id: string;
    name: string;
    description: string;
    image_description?: string; // Add image description field
    type: string;
    role?: string;
    context?: string;
    image_url: string;
    frame_width?: number;
    frame_color?: string;
    name_color?: string;
    type_color?: string;
    role_color?: string;
    description_color?: string;
    context_color?: string;
    format?: "framed" | "fullBleed";
    background_gradient?: string;
    is_premium_generation?: boolean;
    custom_generation_type_id?: string; // Track if this card was generated with a custom type
    is_uploaded_image?: boolean; // Track if image was uploaded by user
    user_id: string;
    collection_id?: string;
    collections?: any;
    shadow_card_id?: string;
    shadow_card?: Card | Card[] | null;
    isDeck?: boolean; // Add deck flag
  };

  const { width: screenWidth } = useWindowDimensions();

  // Horizontal scrolling doesn't need column management
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [mintingNFT, setMintingNFT] = useState(false);
  const [selectedType, setSelectedType] = useState<CollectionType>('personal');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [phenomenaTypes, setPhenomenaTypes] = useState<string[]>(['All']);
  const [selectedPhenomena, setSelectedPhenomena] = useState<string>('All');
  const [showPhenomenaMenu, setShowPhenomenaMenu] = useState(false);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [flipAnimations, setFlipAnimations] = useState<Map<string, Animated.Value>>(new Map());
  const [sharingCard, setSharingCard] = useState(false);
  const viewShotRefs = useRef<Map<string, ViewShot | null>>(new Map());
  const { height: screenHeight } = useWindowDimensions();
  const router = useRouter();
  const [hiddenCards, setHiddenCards] = useState<Set<string>>(new Set());
  const [favoritedCards, setFavoritedCards] = useState<Set<string>>(new Set());
  
  // New deck viewing state
  const [viewMode, setViewMode] = useState<'cards' | 'decks'>('cards');
  const [customDeckImages, setCustomDeckImages] = useState<Record<string, string>>({});
  
  // Deck management state
  const [showDeckActions, setShowDeckActions] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Card | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedDeckForImage, setSelectedDeckForImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  
  // Double tap timing ref
  const lastTapRef = useRef<number>(0);
  
  
  // Calculate scaling factor for horizontal scrolling based on device
  const getScaleFactor = () => {
    // For horizontal scrolling, use consistent scaling based on device type
    // Tablets can handle larger text, phones need slightly smaller
    return isTablet() ? 1.0 : 0.85;
  };
  
  // Horizontal scrolling doesn't need orientation management

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
    'Cinzel-Regular': Cinzel_400Regular,
  });

  const fetchCards = useCallback(async (isRefreshing = false) => {
    if (!user) {
      return;
    }

    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      setError('');

      // Optimize queries based on collection type
      switch (selectedType) {
        case 'personal':
          // Use optimized query without expensive joins
          const { data: personalCards, error: personalError } = await supabase
            .from('cards')
            .select(`
              id, name, description, image_description, type, role, context, image_url, frame_width, frame_color, 
              name_color, type_color, description_color, context_color, format, background_gradient, 
              is_premium_generation, custom_generation_type_id, is_uploaded_image, user_id, collection_id, shadow_card_id,
              shadow_card:shadow_card_id(
                id, name, description, type, role, context, image_url, frame_width, frame_color,
                name_color, type_color, description_color, context_color, format, background_gradient,
                is_premium_generation, custom_generation_type_id
              )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (personalError) throw personalError;
          console.log('🔵 DEBUG: Personal cards loaded:', personalCards?.length);
          console.log('🔵 DEBUG: Sample personal card:', personalCards?.[0]);
          setAllCards(personalCards as Card[] ?? []);
          break;

        case 'friends':
          // Optimize friend cards query - first get friend IDs, then get their cards
          const { data: friendRequests, error: friendError } = await supabase
            .from('friend_requests')
            .select('sender_id, receiver_id')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .eq('status', 'accepted');

          if (friendError) throw friendError;

          const friendIds = (friendRequests ?? []).flatMap(fr => 
            fr.sender_id === user.id ? [fr.receiver_id] : [fr.sender_id]
          );

          if (friendIds.length === 0) {
            setAllCards([]);
            break;
          }

          let friendCardsQuery = supabase
            .from('cards')
            .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, is_premium_generation, custom_generation_type_id, is_uploaded_image, user_id, collection_id')
            .in('user_id', friendIds)
            .order('created_at', { ascending: false });

          // Only show cards that are explicitly shared with friends
          try {
            // Test if is_shared_with_friends column exists
            const { error: testError } = await supabase
              .from('cards')
              .select('is_shared_with_friends')
              .limit(1)
              .single();

            if (!testError) {
              // Column exists, modify query to only show cards that are explicitly shared with friends
              friendCardsQuery = friendCardsQuery
                .eq('is_shared_with_friends', true);
            }
          } catch (columnCheckError) {
            // Column doesn't exist, use the basic query
            log('is_public or is_shared_with_friends column not found, using basic friend filter');
          }

          const { data: friendCards, error: friendCardsError } = await friendCardsQuery;

          if (friendCardsError) throw friendCardsError;
          console.log('🟢 DEBUG: Friends cards loaded:', friendCards?.length);
          console.log('🟢 DEBUG: Sample friend card:', friendCards?.[0]);
          console.log('🟢 DEBUG: Friend card has is_shared_with_friends?', friendCards?.[0]?.hasOwnProperty('is_shared_with_friends'));
          setAllCards(friendCards as Card[] || []);
          break;

        case 'public':
          try {
            // First try with is_public column (if migration has been run)
            const { data: publicCards, error: publicError } = await supabase
              .from('cards')
              .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, is_premium_generation, custom_generation_type_id, is_uploaded_image, user_id, collection_id')
              .eq('is_public', true)
              .order('created_at', { ascending: false });

            if (publicError) {
              // If is_public column doesn't exist (error code 42703), fall back to showing cards from other users
              if (publicError.code === '42703' || publicError.message?.includes('is_public') && publicError.message?.includes('does not exist')) {
                log('is_public column not found, falling back to showing other users\' cards');
                const { data: fallbackCards, error: fallbackError } = await supabase
                  .from('cards')
                  .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, is_premium_generation, custom_generation_type_id, is_uploaded_image, user_id, collection_id')
                  .neq('user_id', user.id)
                  .order('created_at', { ascending: false });

                if (fallbackError) throw fallbackError;
                setAllCards(fallbackCards as Card[] ?? []);
                break; // Important: break here to avoid throwing the error
              } else {
                throw publicError;
              }
            } else {
              console.log('🟡 DEBUG: Public cards loaded:', publicCards?.length);
              console.log('🟡 DEBUG: Sample public card:', publicCards?.[0]);
              console.log('🟡 DEBUG: Public card has is_public?', publicCards?.[0]?.hasOwnProperty('is_public'));
              setAllCards(publicCards as Card[] ?? []);
            }
          } catch (publicErr: any) {
            // Check if this is the column not found error one more time
            if (publicErr.code === '42703' || (publicErr.message?.includes('is_public') && publicErr.message?.includes('does not exist'))) {
              log('Caught is_public column error in catch block, using fallback');
              const { data: fallbackCards, error: fallbackError } = await supabase
                .from('cards')
                .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, is_premium_generation, is_uploaded_image, user_id, collection_id')
                .neq('user_id', user.id)
                .order('created_at', { ascending: false });

              if (fallbackError) throw fallbackError;
              console.log('🟡 DEBUG: Public fallback cards loaded:', fallbackCards?.length);
              console.log('🟡 DEBUG: Sample fallback card:', fallbackCards?.[0]);
              setAllCards(fallbackCards as Card[] ?? []);
            } else {
              logError('Public cards query error:', publicErr);
              throw publicErr;
            }
          }
          break;
      }
    } catch (err) {
      logError('Error in fetchCards:', err instanceof Error ? err.message : 'Unknown error');
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

  // Refresh cards when tab is focused (e.g., after creating a card from inbox)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchCards(false);
      }
    }, [user, fetchCards])
  );

  // Load phenomena types and deck images on component mount
  useEffect(() => {
    loadPhenomenaTypes();
    loadCustomDeckImages();
  }, []);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCards(true);
  }, [fetchCards]);

  // Load phenomena types from database, fallback to AsyncStorage
  const loadPhenomenaTypes = async () => {
    try {
      if (!user) {
        // Use default types if no user
        const defaultTypes = ['Intention', 'Context', 'Impact', 'Accuracy', 'Agenda', 'Needs', 'Emotion', 'Role'];
        setPhenomenaTypes(['All', ...defaultTypes]);
        return;
      }

      // First try to load from database
      const { data: userData, error: dbError } = await supabase
        .from('users')
        .select('custom_phenomena_types')
        .eq('id', user.id)
        .single();

      if (dbError) {
        logError('Error loading phenomena types from database:', dbError);
        // Fall back to AsyncStorage
        await loadFromAsyncStorage();
        return;
      }

      if (userData?.custom_phenomena_types) {
        setPhenomenaTypes(['All', ...userData.custom_phenomena_types]);
      } else {
        // If no database data, try AsyncStorage
        await loadFromAsyncStorage();
      }
    } catch (error) {
      logError('Error loading phenomena types:', error);
      // Fall back to AsyncStorage
      await loadFromAsyncStorage();
    }
  };

  const loadFromAsyncStorage = async () => {
    try {
      const storedPhenomena = await AsyncStorage.getItem('@phenomena_types');
      if (storedPhenomena) {
        const parsedPhenomena = JSON.parse(storedPhenomena);
        setPhenomenaTypes(['All', ...parsedPhenomena]);
      } else {
        // Default phenomena types if none stored
        const defaultTypes = ['Intention', 'Context', 'Impact', 'Accuracy', 'Agenda', 'Needs', 'Emotion', 'Role'];
        setPhenomenaTypes(['All', ...defaultTypes]);
      }
    } catch (error) {
      logError('Error loading from AsyncStorage:', error);
      // Fallback to default types
      const defaultTypes = ['Intention', 'Context', 'Impact', 'Accuracy', 'Agenda', 'Needs', 'Emotion', 'Role'];
      setPhenomenaTypes(['All', ...defaultTypes]);
    }
  };

  // Load custom deck images from database
  const loadCustomDeckImages = async () => {
    try {
      if (!user) {
        return;
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('custom_deck_images')
        .eq('id', user.id)
        .single();

      if (error) {
        logError('Error loading custom deck images:', error);
        return;
      }

      if (userData?.custom_deck_images) {
        setCustomDeckImages(userData.custom_deck_images);
      }
    } catch (error) {
      logError('Error loading custom deck images:', error);
    }
  };

  // Save custom deck images to database
  const saveCustomDeckImages = async (images: Record<string, string>) => {
    try {
      if (!user) {
        logError('No user found for saving deck images');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ custom_deck_images: images })
        .eq('id', user.id);

      if (error) {
        logError('Error saving deck images to database:', error);
      }
    } catch (error) {
      logError('Error saving deck images:', error);
    }
  };

  // Save phenomena types to database
  const savePhenomenaTypes = async (types: string[]) => {
    try {
      if (!user) {
        logError('No user found for saving phenomena types');
        return;
      }

      // Save to database
      const { error } = await supabase
        .from('users')
        .update({ custom_phenomena_types: types })
        .eq('id', user.id);

      if (error) {
        logError('Error saving phenomena types to database:', error);
        // Fall back to AsyncStorage
        await AsyncStorage.setItem('@phenomena_types', JSON.stringify(types));
      }
    } catch (error) {
      logError('Error saving phenomena types:', error);
      // Fall back to AsyncStorage
      try {
        await AsyncStorage.setItem('@phenomena_types', JSON.stringify(types));
      } catch (storageError) {
        logError('Error saving to AsyncStorage:', storageError);
      }
    }
  };

  // Add new deck (phenomena type)
  const addNewDeck = async () => {
    if (!newDeckName.trim()) {
      Alert.alert('Error', 'Please enter a deck name');
      return;
    }

    const trimmedName = newDeckName.trim();
    
    if (phenomenaTypes.includes(trimmedName)) {
      Alert.alert('Error', 'This deck type already exists');
      return;
    }

    const updatedTypes = [...phenomenaTypes, trimmedName];
    setPhenomenaTypes(updatedTypes);
    await savePhenomenaTypes(updatedTypes);
    setNewDeckName('');
    setShowAddDeck(false);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // Remove deck (phenomena type)
  const removeDeck = async (deckName: string) => {
    // Prevent removal of default phenomena types
    const DEFAULT_PHENOMENA = ['Intention', 'Context', 'Impact', 'Accuracy', 'Agenda', 'Needs', 'Emotion', 'Role'];
    if (DEFAULT_PHENOMENA.includes(deckName)) {
      Alert.alert('Cannot Remove', 'Default deck types cannot be removed');
      return;
    }

    Alert.alert(
      'Remove Deck',
      `Are you sure you want to remove "${deckName}"? This will also remove its custom image.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updatedTypes = phenomenaTypes.filter(type => type !== deckName);
            setPhenomenaTypes(updatedTypes);
            await savePhenomenaTypes(updatedTypes);
            
            // Also remove custom image for this deck
            const updatedImages = { ...customDeckImages };
            delete updatedImages[deckName];
            setCustomDeckImages(updatedImages);
            await saveCustomDeckImages(updatedImages);
            
            setShowDeckActions(false);
            setSelectedDeck(null);
            
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          }
        }
      ]
    );
  };

  // Handle deck image upload
  const handleDeckImageUpload = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to upload images.');
        return;
      }

      setUploadingImage(true);

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [2.5, 3.5], // Card aspect ratio
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && selectedDeckForImage) {
        const imageUri = result.assets[0].uri;
        
        // Update custom deck images
        const updatedImages = {
          ...customDeckImages,
          [selectedDeckForImage]: imageUri
        };
        
        setCustomDeckImages(updatedImages);
        await saveCustomDeckImages(updatedImages);
        
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        
        setShowImageModal(false);
        setSelectedDeckForImage(null);
        setImagePrompt('');
      }
    } catch (error) {
      logError('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Remove deck custom image
  const handleRemoveDeckImage = async () => {
    if (!selectedDeckForImage) return;
    
    const updatedImages = { ...customDeckImages };
    delete updatedImages[selectedDeckForImage];
    
    setCustomDeckImages(updatedImages);
    await saveCustomDeckImages(updatedImages);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    setShowImageModal(false);
    setSelectedDeckForImage(null);
    setImagePrompt('');
  };

  // Generate deck image with AI
  const handleGenerateDeckImage = async () => {
    if (!selectedDeckForImage) return;
    if (!imagePrompt.trim()) {
      Alert.alert('Add a description', 'Please describe the image you want for this deck.');
      return;
    }
    try {
      setGeneratingImage(true);
      // Invoke the same edge function used in card creation
      const { data, error } = await supabase.functions.invoke('generate-card-image', {
        body: {
          name: `${selectedDeckForImage} Deck`,
          description: imagePrompt.trim(),
          userId: user?.id,
        },
      });

      if (error) {
        logError('Generate image error:', error);
        throw new Error(error.message || 'Failed to generate image');
      }

      if (!data?.imageUrl) {
        throw new Error('No image URL returned from generator');
      }

      const updatedImages = {
        ...customDeckImages,
        [selectedDeckForImage]: data.imageUrl as string,
      };
      setCustomDeckImages(updatedImages);
      await saveCustomDeckImages(updatedImages);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Close modal and reset prompt
      setShowImageModal(false);
      setSelectedDeckForImage(null);
      setImagePrompt('');
    } catch (err) {
      logError('AI generation failed:', err);
      Alert.alert('Generation failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setGeneratingImage(false);
    }
  };

  // Generate deck objects that can be displayed like cards
  const generateDecks = useCallback((): Card[] => {
    if (!phenomenaTypes) return [];
    
    // Filter out 'All' from phenomena types for decks
    const deckTypes = phenomenaTypes.filter(type => type !== 'All');
    
    return deckTypes.map(deckType => {
      const customImage = customDeckImages[deckType];
      const defaultGradients: Record<string, [string, string]> = {
        'Intention': ['#6366f1', '#8b5cf6'],
        'Context': ['#0ea5e9', '#06b6d4'],
        'Impact': ['#f59e0b', '#ef4444'],
        'Accuracy': ['#10b981', '#059669'],
        'Agenda': ['#ec4899', '#be185d'],
        'Needs': ['#8b5cf6', '#6366f1'],
        'Emotion': ['#ef4444', '#dc2626'],
        'Role': ['#06b6d4', '#0891b2'],
      };
      
      const gradientColors = defaultGradients[deckType] || ['#374151', '#1f2937'];
      
      return {
        id: `deck_${deckType}`,
        name: deckType,
        description: `${deckType} phenomenon deck`,
        type: 'Deck',
        image_url: customImage || '', // Use custom image or empty for gradient
        user_id: user?.id || '',
        format: 'fullBleed' as const,
        background_gradient: JSON.stringify(gradientColors),
        // Mark as deck for special handling
        isDeck: true,
      } as Card & { isDeck: boolean };
    });
  }, [phenomenaTypes, customDeckImages, user?.id]);

  // Filter cards or decks based on view mode and search query
  const filterItems = useCallback((itemsToFilter: Card[]) => {
    let filtered = itemsToFilter;
    
    if (viewMode === 'cards') {
      // Filter by phenomena type
      if (selectedPhenomena !== 'All') {
        filtered = filtered.filter(card => card.type === selectedPhenomena);
      }
      
      // Filter out hidden cards (only for Friends and Public tabs)
      if (selectedType === 'friends' || selectedType === 'public') {
        filtered = filtered.filter(card => !hiddenCards.has(card.id));
      }
    }
    
    // Filter by search query (name)
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [selectedPhenomena, searchQuery, viewMode, selectedType, hiddenCards]);

  // Update displayed items based on view mode and filters
  useEffect(() => {
    if (viewMode === 'cards') {
      const filteredCards = filterItems(allCards);
      setCards(filteredCards);
    } else {
      // Generate and filter decks
      const decks = generateDecks();
      const filteredDecks = filterItems(decks);
      setCards(filteredDecks);
    }
  }, [viewMode, selectedPhenomena, searchQuery, allCards, phenomenaTypes, customDeckImages, filterItems, generateDecks]);

  const handleDelete = async (cardId: string) => {
    if (!cardId) {
      setDeleteError('Invalid card selected');
      return;
    }

    if (!user?.id) {
      setDeleteError('User not authenticated');
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    try {
      log('🗑️ Attempting to delete card:', cardId, 'for user:', user.id);
      
      // First, check if this card is being used as a shadow card by other cards
      const { data: referencingCards, error: checkError } = await supabase
        .from('cards')
        .select('id, name')
        .eq('shadow_card_id', cardId)
        .eq('user_id', user.id);

      if (checkError) {
        logError('Error checking shadow card references:', checkError);
        throw new Error(`Database error: ${checkError.message}`);
      }

      // If this card is used as a shadow card, unlink it first
      if (referencingCards && referencingCards.length > 0) {
        log('🔗 Card is used as shadow by:', referencingCards.map(c => c.name).join(', '));
        log('🔗 Unlinking shadow card references...');
        
        const { error: unlinkError } = await supabase
          .from('cards')
          .update({ shadow_card_id: null })
          .eq('shadow_card_id', cardId)
          .eq('user_id', user.id);

        if (unlinkError) {
          logError('Error unlinking shadow card:', unlinkError);
          throw new Error(`Failed to unlink shadow card: ${unlinkError.message}`);
        }

        log('✅ Shadow card references unlinked successfully');
      }
      
      // Now delete the card
      const { error: deleteError, data } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId)
        .eq('user_id', user.id)
        .select(); // Add select to see what was deleted

      log('Delete response:', { error: deleteError, data });

      if (deleteError) {
        logError('Supabase delete error:', deleteError);
        throw new Error(`Database error: ${deleteError.message} (Code: ${deleteError.code})`);
      }

      if (!data || data.length === 0) {
        throw new Error('Card not found or you do not have permission to delete it');
      }

      log('✅ Card deleted successfully:', data);
      setAllCards(prevCards => prevCards.filter(card => card.id !== cardId));
      setShowActions(false);
      setSelectedCard(null);
      
    } catch (err) {
      logError('Delete error details:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      logError('Final error message:', errorMessage);
      setDeleteError(errorMessage);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEdit = (card: Card) => {
    // Close modal
    setShowActions(false);
    
    log('📝 handleEdit called with card:', card.name, card.id);
    log('📝 Current selectedCard state:', selectedCard?.name, selectedCard?.id);
    
    // Navigate to Edit page
    router.push({
      pathname: '/card-creation-new',
      params: {
        id: card.id,
        name: card.name,
        description: card.description,
        image_description: card.image_description || '', // Include image description for editing
        type: card.type,
        role: card.role || '',
        context: card.context || '',
        image_url: card.image_url,
        frame_color: card.frame_color || '',
        name_color: card.name_color || '',
        type_color: card.type_color || '',
        description_color: card.description_color || '',
        context_color: card.context_color || '',
        edit_mode: 'true',
        returnTo: 'cards'
      }
    });
  };

  const handleMintNFT = async (card: Card) => {
    // Close the settings modal
    setShowActions(false);
    
    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Check if user is logged in
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to mint NFTs.');
      return;
    }
    
    // Confirm minting with user
    Alert.alert(
      'Mint to Official Collection',
      `Mint "${card.name}" to the official Subtext NFT collection?\n\nThis will create a permanent record of your card on the blockchain.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mint NFT',
          onPress: () => mintCardAsNFT(card)
        }
      ]
    );
  };

  const mintCardAsNFT = async (card: Card) => {
    setMintingNFT(true);
    
    try {
      log('🎴 Minting card to official collection:', card.name);
      
      // Call server-side Edge Function to mint NFT
      const { data, error } = await supabase.functions.invoke('mint-nft', {
        body: {
          cardId: card.id,
          userId: user?.id
        }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to mint NFT');
      }
      
      if (!data.success) {
        if (data.alreadyMinted) {
          Alert.alert(
            'Already Minted',
            'This card has already been minted to the official Subtext NFT collection.',
            [{ text: 'OK' }]
          );
          return;
        }
        throw new Error(data.error || 'Minting failed');
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Get user email for display
      const userEmail = data.userEmail || user?.email || 'your account';
      
      Alert.alert(
        'NFT Minted Successfully! 🎉',
        `Your card "${card.name}" has been minted to the official Subtext NFT collection.\n\n` +
        `Minted for: ${userEmail}\n` +
        `Token ID: ${data.tokenId}\n\n` +
        `This card is now part of the permanent Subtext collection on the blockchain.`,
        [
          { text: 'OK' },
          { 
            text: 'View on Polygonscan', 
            onPress: () => Linking.openURL(data.explorerUrl)
          },
          { 
            text: 'View on OpenSea', 
            onPress: () => Linking.openURL(data.openSeaUrl)
          }
        ]
      );
      
      log('✅ NFT minted successfully:', data.tokenId);
      
    } catch (error: any) {
      logError('❌ Minting error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Minting Failed',
        error.message || 'Failed to mint NFT. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setMintingNFT(false);
    }
  };

  const handleShareCard = async (card: Card) => {
    const viewShotRef = viewShotRefs.current.get(card.id);
    if (!viewShotRef || !viewShotRef.capture) {
      Alert.alert('Error', 'Unable to capture card image. Please try again.');
      logError('ViewShot ref not found for card:', card.id);
      return;
    }

    setSharingCard(true);
    setShowActions(false); // Close modal first

    try {
      // Give a moment for modal to close
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Capture the specific card as image
      log('📸 Capturing card:', card.name, card.id);
      const uri = await viewShotRef.capture();

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      // Share the captured image
      await Sharing.shareAsync(uri, {
        dialogTitle: `Share ${card.name}`,
        mimeType: 'image/png',
      });

      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

    } catch (error) {
      logError('Error sharing card:', error);
      Alert.alert('Error', 'Failed to share card. Please try again.');
    } finally {
      setSharingCard(false);
    }
  };

  const handleHideCard = (card: Card) => {
    setShowActions(false);
    setHiddenCards(prev => new Set(prev.add(card.id)));
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    log('🙈 Card hidden:', card.name, card.id);
  };

  const handleFavoriteCard = (card: Card) => {
    setShowActions(false);
    const isFavorited = favoritedCards.has(card.id);
    
    if (isFavorited) {
      // Unfavorite
      setFavoritedCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(card.id);
        return newSet;
      });
      log('💔 Card unfavorited:', card.name, card.id);
    } else {
      // Favorite
      setFavoritedCards(prev => new Set(prev.add(card.id)));
      log('❤️ Card favorited:', card.name, card.id);
    }
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // Calculate scaling factor based on number of columns
  const scaleFactor = getScaleFactor();
  
  // Calculate card dimensions to fit completely on screen with larger size
  const getCardDimensions = () => {
    // Calculate available height (subtract space for top controls and floating tab bar overlay)
    // Top controls: collection type buttons + search (~60px) + padding
    // Floating tab bar overlaps content, so only reserve space for top controls
    const reservedHeight = 100;
    const availableHeight = screenHeight - reservedHeight;
    
    // Calculate available width (subtract horizontal padding)
    const horizontalPadding = 24; // Reduced from 32 to 24 for larger cards
    const availableWidth = screenWidth - horizontalPadding;
    
    // Calculate card dimensions based on 2.3:3.6 aspect ratio (slightly taller and narrower for premium cards)
    // Try height-constrained first
    let cardHeight = availableHeight;
    let cardWidth = cardHeight * (2.3 / 3.6);
    
    // If width exceeds available space, constrain by width instead
    if (cardWidth > availableWidth) {
      cardWidth = availableWidth;
      cardHeight = cardWidth * (3.6 / 2.3);
    }
    
    // Increased minimum readable size for better visibility
    const minCardHeight = 510; // Sweet spot between 500 and 520
    const minCardWidth = minCardHeight * (2.3 / 3.6);
    
    cardHeight = Math.max(minCardHeight, cardHeight);
    cardWidth = Math.max(minCardWidth, cardWidth);
    
    // Image should take up approximately half the card height
    const imageHeight = cardHeight * 0.5;
    
    return { cardWidth, cardHeight, imageHeight };
  };

  const renderCard = ({ item }: { item: Card }) => {
    // Frame colors are always based on card type
    const cardColors = getCardTypeColor(item.type);
    
    // Parse background gradient for card background (separate from frame)
    const getBackgroundGradient = (): [string, string] | null => {
      if (item.background_gradient) {
        try {
          const gradient = JSON.parse(item.background_gradient);
          if (Array.isArray(gradient) && gradient.length >= 2) {
            return [gradient[0], gradient[1]];
          }
        } catch (error) {
          logError('Error parsing background gradient:', error);
        }
      }
      return null; // No background gradient
    };
    
    const backgroundGradient = getBackgroundGradient();
    
    // Double tap detection - handles both cards and decks
    const handleDoubleTapCard = () => {
      const now = Date.now();
      const DOUBLE_PRESS_DELAY = 300;
      if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_PRESS_DELAY) {
        // Check if this is a deck
        const isDeck = (item as any).isDeck;
        
        if (isDeck) {
          // Show deck management actions modal
          log('🎯 DECK DOUBLE TAP - showing deck actions:', item.name);
          setSelectedDeck(item);
          setShowDeckActions(true);
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        } else {
          // Handle normal card double tap - flip-state aware
          let targetCard: Card;
          
          if (!isFlipped) {
            // User is viewing FRONT side → always edit original card
            targetCard = item;
            log('🟢 FRONT SIDE DOUBLE TAP - editing original card:', item.name, item.id);
          } else {
            // User is viewing BACK side → edit what's displayed on back
            const shadowCard = item.shadow_card 
              ? (Array.isArray(item.shadow_card) ? item.shadow_card[0] : item.shadow_card)
              : null;
            
            if (shadowCard) {
              // Shadow exists and is displayed → edit shadow
              targetCard = shadowCard;
              log('🔵 BACK SIDE DOUBLE TAP (with shadow) - editing shadow card:', shadowCard.name, shadowCard.id);
            } else {
              // No shadow, showing default back → edit original
              targetCard = item;
              log('🟡 BACK SIDE DOUBLE TAP (no shadow) - editing original card:', item.name, item.id);
            }
          }
          
          // Double tap detected - show modal for the contextually correct card
          log('🎯 Setting selectedCard to:', targetCard.name, targetCard.id);
          setSelectedCard(targetCard);
          setShowActions(true);
          setDeleteError('');
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      } else {
        // Single tap - reserved for future interactions
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
      lastTapRef.current = now;
    };
    
    // Long press handling - flip animation for cards, image upload for decks
    const handleLongPress = () => {
      const isDeck = (item as any).isDeck;
      
      if (isDeck) {
        // Deck long press - open image upload modal
        log('🔗 DECK LONG PRESS - opening image modal:', item.name);
        setSelectedDeckForImage(item.name);
        setShowImageModal(true);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
        return;
      }
      // Get or create animation value for this card
      let animValue = flipAnimations.get(item.id);
      if (!animValue) {
        animValue = new Animated.Value(0);
        setFlipAnimations(prev => new Map(prev.set(item.id, animValue!)));
      }
      
      const isCurrentlyFlipped = flippedCards.has(item.id);
      const targetValue = isCurrentlyFlipped ? 0 : 1;
      
      // Start flip animation
      Animated.timing(animValue!, {
        toValue: targetValue,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        // Update flip state after animation completes
        setFlippedCards(prev => {
          const newSet = new Set(prev);
          if (isCurrentlyFlipped) {
            newSet.delete(item.id);
          } else {
            newSet.add(item.id);
          }
          return newSet;
        });
      });
      
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    };
    
    const isFlipped = flippedCards.has(item.id);
    
    // Check if this is a "black" card (no gradient or Classic Black gradient)
    // These cards should keep their original black text backgrounds
    const isBlackCard = !backgroundGradient || 
      (backgroundGradient[0] === '#1a1a1a' && backgroundGradient[1] === '#000000');
    
    // Conditional text background color
    const textBackgroundColor = isBlackCard ? undefined : 'transparent';
    
    // Get card dimensions based on the 2.5:3.5 ratio
    const { cardWidth, cardHeight, imageHeight } = getCardDimensions();
    
    // Calculate border width based on scale factor
    const borderWidth = Math.max(1, 3 * scaleFactor); // Min 1px, max 3px
    
    // Calculate font sizes based on scale factor
    const nameFontSize = Math.max(12, Math.round(24 * scaleFactor));
    const typeFontSize = Math.max(10, Math.round(16 * scaleFactor));
    const baseFontSize = Math.max(9, Math.round(16 * scaleFactor));
    const contextFontSize = Math.max(8, Math.round(14 * scaleFactor));
        
    
    // Calculate adaptive description font size based on text length
    const getAdaptiveDescriptionFontSize = (text: string, format: 'fullBleed' | 'framed' | undefined) => {
      if (!text) return baseFontSize;

      const textLength = text.length;
      let sizeFactor = 1.0;

      if (format === 'framed') {
        // Framed cards: dynamic scaling – allow slight enlarging for very short text
        if (textLength < 20) {
          sizeFactor = 1.25; // enlarge 25%
        } else if (textLength < 40) {
          sizeFactor = 1.15; // enlarge 15%
        } else if (textLength > 200) {
          sizeFactor = 0.8;
        } else if (textLength > 120) {
          sizeFactor = 0.9;
        } else if (textLength > 80) {
          sizeFactor = 0.95;
        }
      } else {
        // Full-bleed or default cards: more aggressive shrinking
        if (textLength > 200) {
          sizeFactor = 0.7;
        } else if (textLength > 120) {
          sizeFactor = 0.8;
        } else if (textLength > 80) {
          sizeFactor = 0.9;
        }
      }

      // Clamp to reasonable upper bound to avoid absurdly large text
      const maxFontSize = Math.round(baseFontSize * 1.3);
      return Math.min(Math.max(8, Math.round(baseFontSize * sizeFactor)), maxFontSize);
    };
    
    const descriptionFontSize = getAdaptiveDescriptionFontSize(item.description, item.format);
    
    // Calculate number of lines based on text length and font size
    const getNumberOfLines = (text: string, fontSize: number, format: 'fullBleed' | 'framed' | undefined) => {
      if (!text) return 3;
      const textLength = text.length;
      const baseLinesForScale = Math.max(3, Math.round(6 * scaleFactor));
      
      if (format === 'fullBleed') {
        // For full-bleed cards, simulate the corner-shaped layout
        const cornerShapeWidthPercents = [0.45, 0.65, 0.85, 1.0];
        const baseCharsPerFullWidth = Math.floor(cardWidth / (fontSize * 0.6));
        
        let remainingChars = textLength;
        let lineCount = 0;
        const maxLines = 4;
        
        for (let i = 0; i < maxLines && remainingChars > 0; i++) {
          const widthPercent = cornerShapeWidthPercents[i] || 1.0;
          const charsThisLine = Math.floor(baseCharsPerFullWidth * widthPercent);
          remainingChars -= charsThisLine;
          lineCount++;
        }
        
        return Math.max(baseLinesForScale, lineCount);
      } else {
        // For framed cards, use simpler calculation
        const containerWidth = 320;
        const charsPerLine = containerWidth / fontSize;
        const estimatedLines = Math.ceil(textLength / charsPerLine);
        return Math.max(baseLinesForScale, estimatedLines);
      }
    };

    const numberOfLines = getNumberOfLines(item.description, descriptionFontSize, item.format);

    // Height for gradient overlay: match text block (title + description) but cap.
    const textBlockHeight = nameFontSize + (descriptionFontSize * numberOfLines) + Math.round(24 * scaleFactor);
    const overlayHeight = Math.min(Math.round(cardHeight * 0.45), Math.max(50, textBlockHeight + Math.round(8 * scaleFactor)));
    
    // Get animation value for this card
    const animValue = flipAnimations.get(item.id) || new Animated.Value(0);
    
    // Create interpolated rotation values
    const frontRotateY = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });
    
    const backRotateY = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['180deg', '360deg'],
    });
    
    // Card front component
    const renderCardFront = () => {
    
    // If the card uses the full-bleed format, render it with edge-to-edge art and text overlays
    if (item.format === 'fullBleed') {
      // For premium generation or custom generation types, use completely custom container for clean display
      if (item.is_premium_generation || item.custom_generation_type_id) {
        return (
          <Pressable
            style={{
              width: cardWidth, 
              height: cardHeight,
              backgroundColor: '#000000', // Pure black to complement trading card artwork
              borderRadius: 16,
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden'
            }}
            onPress={() => handleDoubleTapCard()}
            onLongPress={handleLongPress}
          >
            <Image 
              source={{ uri: item.image_url }} 
              style={{
                width: '100%', // Full size for maximum impact
                height: '100%',
                borderRadius: 12,
              }} 
              resizeMode="cover" // Use cover to fill entire container
            />
          </Pressable>
        );
      }
      
      // Check if this is a deck
      const isDeck = (item as any).isDeck;
      
      if (isDeck) {
        // Deck rendering - show custom image or gradient background
        return (
          <Pressable
            style={[styles.fullBleedCard, { width: cardWidth, height: cardHeight }]}
            onPress={() => handleDoubleTapCard()}
            onLongPress={handleLongPress}
          >
            {item.image_url ? (
              // Show custom deck image
              <Image source={{ uri: item.image_url }} style={styles.fullBleedImage} resizeMode="cover" />
            ) : (
              // Show gradient background for decks without custom images
              <LinearGradient
                colors={backgroundGradient || ['#374151', '#1f2937']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fullBleedImage}
              />
            )}
            
            {/* Deck title overlay */}
            <View style={styles.deckOverlay}>
              <Text style={[styles.deckTitle, { fontSize: Math.max(20, nameFontSize + 4) }]}>
                {item.name}
              </Text>
              <Text style={[styles.deckLabel, { fontSize: Math.max(14, typeFontSize) }]}>
                Deck
              </Text>
            </View>
          </Pressable>
        );
      }
      
      // Regular fullBleed rendering for legacy cards
      return (
        <Pressable
          style={[
            styles.fullBleedCard, 
            { width: cardWidth, height: cardHeight },
            // Remove shadows for uploaded images
            item.is_uploaded_image && {
              elevation: 0,
              shadowColor: 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0,
              shadowRadius: 0,
            }
          ]}
          onPress={() => handleDoubleTapCard()}
          onLongPress={handleLongPress}
        >
          <Image source={{ uri: item.image_url }} style={styles.fullBleedImage} resizeMode="cover" />

          {/* Gradient overlay removed - no longer needed since text overlays are hidden */}



          {/* Hide text overlays for all fullBleed cards - text should be integrated into the image */}
          {false && item.type ? (
            <Text
              style={[
                styles.fullBleedCorner,
                styles.topRight, // Changed from topLeft
                { fontSize: typeFontSize, color: item.type_color || '#FFFFFF' },
              ]}
            >
              {item.type}
            </Text>
          ) : null}

          {false && item.role ? (
            <Text
              style={[
                styles.fullBleedCorner,
                styles.topLeft, // Moved from bottomLeft
                { fontSize: typeFontSize, color: item.role_color || '#FFFFFF' },
              ]}
            >
              {item.role}
            </Text>
          ) : null}

          {/* Hide name and description overlays for all fullBleed cards */}
          {false && item.description ? (
            <View style={styles.cornerTextContainer}>
              {item.name ? (
                <Text
                  style={[
                    styles.fullBleedName,
                    { fontSize: nameFontSize, color: item.name_color || '#FFFFFF' },
                  ]}
                  numberOfLines={2} // Allow wrapping for longer titles
                >
                  {item.name}
                </Text>
              ) : null}
              {(() => {
                // Corner-shaped text layout algorithm
                const words = item.description.split(' ');
                const lineHeight = Math.max(12, Math.round(descriptionFontSize * 1.4));
                const maxLines = numberOfLines; // Allow as many lines as calculated
                
                // Define corner shape parameters - each line gets progressively wider
                const cornerShapeWidthPercents = [0.45, 0.65, 0.85, 1.0]; // As decimal values
                const availableWidth = cardWidth - 24; // Account for container's horizontal padding (12px on each side)
                
                // Calculate approximate characters per line based on font size and width
                const getCharsPerLine = (widthPercent: number, fontSize: number) => {
                  const baseCharsPerFullWidth = Math.floor(cardWidth / (fontSize * 0.6)); // Rough estimate
                  return Math.floor(baseCharsPerFullWidth * widthPercent);
                };
                
                // Break text into corner-shaped lines
                const lines: string[] = [];
                let remainingText = item.description;
                
                for (let lineIndex = 0; lineIndex < maxLines && remainingText.length > 0; lineIndex++) {
                  const widthPercent = cornerShapeWidthPercents[lineIndex] || 1.0;
                  const charsPerLine = getCharsPerLine(widthPercent, descriptionFontSize);
                  
                  if (remainingText.length <= charsPerLine) {
                    // Last line - use all remaining text
                    lines.push(remainingText.trim());
                    break;
                  } else {
                    // Find the best break point (prefer word boundaries)
                    let breakPoint = charsPerLine;
                    const textToBreak = remainingText.substring(0, charsPerLine + 20); // Look ahead a bit
                    const lastSpaceInRange = textToBreak.lastIndexOf(' ', charsPerLine);
                    
                    if (lastSpaceInRange > charsPerLine * 0.7) {
                      // Good word boundary found
                      breakPoint = lastSpaceInRange;
                    }
                    
                    lines.push(remainingText.substring(0, breakPoint).trim());
                    remainingText = remainingText.substring(breakPoint).trim();
                  }
                }
                
                return lines.map((line, index) => (
                  <View
                    key={index}
                    style={{
                      width: Math.floor(availableWidth * (cornerShapeWidthPercents[index] || 1.0)),
                      marginLeft: index === 0 ? 0 : index * 8, // Stagger each line slightly to the right
                    }}
                  >
                    <Text
                      style={[
                        styles.cornerTextLine,
                        {
                          fontSize: descriptionFontSize,
                          lineHeight: lineHeight,
                          color: item.description_color || '#FFFFFF',
                        },
                      ]}
                    >
                      {line}
                    </Text>
                  </View>
                ));
              })()
              }
            </View>
          ) : null}

        </Pressable>
      );
    }
    
    // Calculate padding based on scale factor
    const contentPadding = Math.max(4, Math.round(8 * scaleFactor));
    
    return (
      <Pressable
        style={[
          styles.card,
          { 
            width: cardWidth,
            height: cardHeight,
          },
          // Remove shadows for uploaded images
          item.is_uploaded_image && {
            elevation: 0,
            shadowColor: 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0,
            shadowRadius: 0,
          }
        ]}
        onPress={() => handleDoubleTapCard()}
        onLongPress={handleLongPress}
      >
        <LinearGradient
          colors={cardColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.cardFrame,
            { 
              borderWidth: borderWidth,
              borderColor: item.frame_color || '#C0C0C0',
              height: '100%',
            }
          ]}
        >
          {/* Card Content with conditional background */}
          {backgroundGradient ? (
            <LinearGradient
              colors={backgroundGradient as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.cardContent,
                { 
                  padding: contentPadding,
                  height: '100%',
                  backgroundColor: textBackgroundColor, // Conditional background
                }
              ]}
            >
              {/* Top section - Card name (hidden for premium generation) */}
              {!item.is_premium_generation && (
                <View style={[
                  styles.cardNameContainer,
                  { backgroundColor: textBackgroundColor } // Conditional background
                ]}>
                  <Text 
                    style={[
                      styles.cardName, 
                      { 
                        fontSize: nameFontSize,
                        color: item.name_color || '#FFFFFF' 
                      }
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </View>
              )}

              {/* Middle section - Card image (50% of card height) */}
              <View 
                style={[
                  styles.artContainer,
                  { height: imageHeight }
                ]}
              >
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.cardArt}
                  resizeMode="cover"
                />
              </View>

              {/* Bottom section - Type line and description (hidden for premium generation) */}
              {!item.is_premium_generation && (
                <View style={{ flex: 1 }}>
                  {/* Type line */}
                  <View style={[
                    styles.typeLine, 
                    { 
                      marginTop: contentPadding,
                      backgroundColor: textBackgroundColor // Conditional background
                    }
                  ]}>
                    <View style={styles.typeContainer}>
                      <Text 
                        style={[
                          styles.typeText, 
                          { 
                            fontSize: typeFontSize,
                            color: item.type_color || '#FFFFFF' 
                          }
                        ]}
                      >
                        {item.type}
                      </Text>
                    </View>
                    
                    {item.role && (
                      <View style={styles.roleContainer}>
                        {getCardRoleIcon(item.role)}
                        <Text 
                          style={[
                            styles.roleText, 
                            { 
                              fontSize: Math.max(8, Math.round(14 * scaleFactor)),
                              color: '#FFFFFF' 
                            }
                          ]}
                        >
                          {item.role}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Description - directly below type line */}
                  <View 
                    style={[
                      styles.textBox,
                      { 
                        marginTop: contentPadding / 2,
                        flex: 1,
                        backgroundColor: textBackgroundColor // Conditional background
                      }
                    ]}
                  >
                    <Text 
                      style={[
                        styles.cardDescription, 
                        { 
                          fontSize: descriptionFontSize,
                          lineHeight: Math.max(12, Math.round(descriptionFontSize * 1.4)),
                          color: item.description_color || '#FFFFFF' 
                        }
                      ]}
                      numberOfLines={numberOfLines}
                    >
                      {item.description}
                    </Text>
                  </View>

                  {/* Context - at the bottom of the card */}
                  {item.context && (
                    <View style={[
                      styles.contextContainer, 
                      { 
                        marginTop: contentPadding / 2,
                        backgroundColor: textBackgroundColor // Conditional background
                      }
                    ]}>
                      <Text 
                        style={[
                          styles.contextText, 
                          { 
                            fontSize: contextFontSize,
                            color: item.context_color || '#CCCCCC' 
                          }
                        ]}
                      >
                        {item.context}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </LinearGradient>
          ) : (
            <View 
              style={[
                styles.cardContent,
                { 
                  padding: contentPadding,
                  height: '100%',
                }
              ]}
            >
              {/* Top section - Card name (hidden for premium generation) */}
              {!item.is_premium_generation && (
                <View style={styles.cardNameContainer}>
                  <Text 
                    style={[
                      styles.cardName, 
                      { 
                        fontSize: nameFontSize,
                        color: item.name_color || '#FFFFFF' 
                      }
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </View>
              )}

              {/* Middle section - Card image (50% of card height) */}
              <View 
                style={[
                  styles.artContainer,
                  { height: imageHeight }
                ]}
              >
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.cardArt}
                  resizeMode="cover"
                />
              </View>

              {/* Bottom section - Type line and description (hidden for premium generation) */}
              {!item.is_premium_generation && (
                <View style={{ flex: 1 }}>
                  {/* Type line */}
                  <View style={[styles.typeLine, { marginTop: contentPadding }]}>
                    <View style={styles.typeContainer}>
                      <Text 
                        style={[
                          styles.typeText, 
                          { 
                            fontSize: typeFontSize,
                            color: item.type_color || '#FFFFFF' 
                          }
                        ]}
                      >
                        {item.type}
                      </Text>
                    </View>
                    
                    {item.role && (
                      <View style={styles.roleContainer}>
                        {getCardRoleIcon(item.role)}
                        <Text 
                          style={[
                            styles.roleText, 
                            { 
                              fontSize: Math.max(8, Math.round(14 * scaleFactor)),
                              color: '#FFFFFF' 
                            }
                          ]}
                        >
                          {item.role}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Description - directly below type line */}
                  <View 
                    style={[
                      styles.textBox,
                      { 
                        marginTop: contentPadding / 2,
                        flex: 1,
                      }
                    ]}
                  >
                    <Text 
                      style={[
                        styles.cardDescription, 
                        { 
                          fontSize: descriptionFontSize,
                          lineHeight: Math.max(12, Math.round(descriptionFontSize * 1.4)),
                          color: item.description_color || '#FFFFFF' 
                        }
                      ]}
                      numberOfLines={numberOfLines}
                    >
                      {item.description}
                    </Text>
                  </View>

                  {/* Context - at the bottom of the card */}
                  {item.context && (
                    <View style={[styles.contextContainer, { marginTop: contentPadding / 2 }]}>
                      <Text 
                        style={[
                          styles.contextText, 
                          { 
                            fontSize: contextFontSize,
                            color: item.context_color || '#CCCCCC' 
                          }
                        ]}
                      >
                        {item.context}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </LinearGradient>
      </Pressable>
    );
    }; // Close renderCardFront
    
    // Return animated card container
    return (
      <View style={{ 
        width: cardWidth + 32, 
        height: cardHeight,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Animated.View
          style={[
            { 
              position: 'absolute',
              width: cardWidth, 
              height: cardHeight,
              transform: [{ rotateY: frontRotateY }],
              backfaceVisibility: 'hidden',
            }
          ]}
        >
          <ViewShot
            ref={(ref) => {
              if (ref) {
                viewShotRefs.current.set(item.id, ref);
              } else {
                viewShotRefs.current.delete(item.id);
              }
            }}
            options={{
              format: 'png',
              quality: 0.9,
            }}
            style={{ width: cardWidth, height: cardHeight }}
          >
            {renderCardFront()}
          </ViewShot>
        </Animated.View>
        <Animated.View
          style={[
            { 
              position: 'absolute',
              width: cardWidth, 
              height: cardHeight,
              transform: [{ rotateY: backRotateY }],
              backfaceVisibility: 'hidden',
            }
          ]}
        >
          <Pressable
            style={styles.cardBackPressable}
            onPress={() => handleDoubleTapCard()}
            onLongPress={handleLongPress}
          >
            {(() => {
              // Get shadow card - handle both single object and array responses from Supabase
              const shadowCard = item.shadow_card 
                ? (Array.isArray(item.shadow_card) ? item.shadow_card[0] : item.shadow_card)
                : null;
              
              if (shadowCard) {
                // Render the shadow card as a complete card using the same logic as renderCardFront
                // but with the shadow card's data
                const shadowItem = shadowCard;
                
                // Use the same card rendering logic but with shadow card data
                const shadowBackgroundGradient = shadowItem.background_gradient 
                  ? JSON.parse(shadowItem.background_gradient) 
                  : null;
                const shadowCardColors = shadowBackgroundGradient || ['#1a1a1a', '#000000'];
                
                // Check if this is a "black" card (no gradient or Classic Black gradient)
                const shadowIsBlackCard = !shadowBackgroundGradient || 
                  (shadowBackgroundGradient[0] === '#1a1a1a' && shadowBackgroundGradient[1] === '#000000');
                
                const shadowTextBackgroundColor = shadowIsBlackCard ? undefined : 'transparent';
                
                // Calculate font sizes based on scale factor (same as front card)
                const shadowNameFontSize = Math.max(12, Math.round(24 * scaleFactor));
                const shadowTypeFontSize = Math.max(10, Math.round(16 * scaleFactor));
                const shadowBaseFontSize = Math.max(9, Math.round(16 * scaleFactor));
                const shadowContextFontSize = Math.max(8, Math.round(14 * scaleFactor));
                
                // Get adaptive description font size for shadow card
                const shadowDescriptionFontSize = getAdaptiveDescriptionFontSize(shadowItem.description || '', shadowItem.format);
                
                if (shadowItem.format === 'fullBleed') {
                  // For premium generation shadow cards, show pure image without overlays
                  if (shadowItem.is_premium_generation) {
                    return (
                      <Image source={{ uri: shadowItem.image_url }} style={styles.fullBleedImage} resizeMode="cover" />
                    );
                  }
                  
                  // Render shadow card as full bleed with same layout as normal full bleed
                  return (
                    <>
                      <Image source={{ uri: shadowItem.image_url }} style={styles.fullBleedImage} resizeMode="cover" />

                      {/* Gradient overlay removed - no longer needed since text overlays are hidden */}

                      {/* Type label in top right - hidden for all fullBleed shadow cards */}
                      {false && shadowItem.type ? (
                        <Text
                          style={[
                            styles.fullBleedCorner,
                            styles.topRight,
                            { fontSize: shadowTypeFontSize, color: shadowItem.type_color || '#FFFFFF' },
                          ]}
                        >
                          {shadowItem.type}
                        </Text>
                      ) : null}

                      {/* Role label in top left - hidden for all fullBleed shadow cards */}
                      {false && shadowItem.role ? (
                        <Text
                          style={[
                            styles.fullBleedCorner,
                            styles.topLeft,
                            { fontSize: shadowTypeFontSize, color: shadowItem.role_color || '#FFFFFF' },
                          ]}
                        >
                          {shadowItem.role}
                        </Text>
                      ) : null}

                      {/* Title and description in corner layout - hidden for all fullBleed shadow cards */}
                      {false && shadowItem.description ? (
                        <View style={styles.cornerTextContainer}>
                          {shadowItem.name ? (
                            <Text
                              style={[
                                styles.fullBleedName,
                                { fontSize: shadowNameFontSize, color: shadowItem.name_color || '#FFFFFF' },
                              ]}
                              numberOfLines={2}
                            >
                              {shadowItem.name}
                            </Text>
                          ) : null}
                          {(() => {
                            // Corner-shaped text layout algorithm - same as normal full bleed
                            const words = shadowItem.description.split(' ');
                            const lineHeight = Math.max(12, Math.round(shadowDescriptionFontSize * 1.4));
                            const maxLines = Math.min(4, Math.ceil((shadowItem.description || '').length / 30));
                            
                            const cornerShapeWidthPercents = [0.45, 0.65, 0.85, 1.0];
                            const availableWidth = cardWidth - 24;
                            
                            const getCharsPerLine = (widthPercent: number, fontSize: number) => {
                              const baseCharsPerFullWidth = Math.floor(cardWidth / (fontSize * 0.6));
                              return Math.floor(baseCharsPerFullWidth * widthPercent);
                            };
                            
                            const lines: string[] = [];
                            let remainingText = shadowItem.description;
                            
                            for (let lineIndex = 0; lineIndex < maxLines && remainingText.length > 0; lineIndex++) {
                              const widthPercent = cornerShapeWidthPercents[lineIndex] || 1.0;
                              const charsPerLine = getCharsPerLine(widthPercent, shadowDescriptionFontSize);
                              
                              if (remainingText.length <= charsPerLine) {
                                lines.push(remainingText.trim());
                                break;
                              } else {
                                let cutIndex = charsPerLine;
                                while (cutIndex > 0 && remainingText[cutIndex] !== ' ') {
                                  cutIndex--;
                                }
                                if (cutIndex === 0) cutIndex = charsPerLine;
                                
                                lines.push(remainingText.substring(0, cutIndex).trim());
                                remainingText = remainingText.substring(cutIndex).trim();
                              }
                            }
                            
                            return lines.map((line, index) => {
                              const widthPercent = cornerShapeWidthPercents[index] || 1.0;
                              const availableWidth = cardWidth - 24;
                              return (
                                <View
                                  key={index}
                                  style={{
                                    width: Math.floor(availableWidth * widthPercent),
                                    marginLeft: index === 0 ? 0 : index * 8, // Stagger each line slightly to the right
                                    marginTop: index === 0 ? 6 : 0, // Add space between title and description
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.cornerTextLine,
                                      {
                                        fontSize: shadowDescriptionFontSize,
                                        lineHeight: lineHeight,
                                        color: shadowItem.description_color || '#FFFFFF',
                                      },
                                    ]}
                                  >
                                    {line}
                                  </Text>
                                </View>
                              );
                            });
                          })()}
                        </View>
                      ) : (
                        !shadowItem.is_premium_generation && shadowItem.name ? (
                          <View style={styles.cornerTextContainer}>
                            <Text
                              style={[
                                styles.fullBleedName,
                                { fontSize: shadowNameFontSize, color: shadowItem.name_color || '#FFFFFF' },
                              ]}
                              numberOfLines={2}
                            >
                              {shadowItem.name}
                            </Text>
                          </View>
                        ) : null
                      )}
                    </>
                  );
                } else {
                  // For premium generation shadow cards, show pure image without overlays
                  if (shadowItem.is_premium_generation) {
                    return (
                      <View 
                        style={[
                          styles.artContainer,
                          { height: cardHeight, width: cardWidth, borderRadius: 16, overflow: 'hidden' }
                        ]}
                      >
                        <Image
                          source={{ uri: shadowItem.image_url }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      </View>
                    );
                  }
                  
                  // Render shadow card as framed (complete card rendering matching front card)
                  const shadowBorderWidth = Math.max(1, 3 * scaleFactor); // Match front card border calculation
                  const shadowContentPadding = Math.max(4, Math.round(8 * scaleFactor));
                  const shadowImageHeight = Math.round(cardHeight * 0.5);
                  
                  return (
                    <LinearGradient
                      colors={shadowCardColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.cardFrame,
                        { 
                          borderWidth: shadowBorderWidth,
                          borderColor: shadowItem.frame_color || '#FFFFFF',
                          height: '100%',
                        }
                      ]}
                    >
                      {/* Card Content with conditional background */}
                      {shadowBackgroundGradient ? (
                        <LinearGradient
                          colors={shadowBackgroundGradient as [string, string, ...string[]]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[
                            styles.cardContent,
                            { 
                              padding: shadowContentPadding,
                              height: '100%',
                              backgroundColor: shadowTextBackgroundColor,
                            }
                          ]}
                        >
                          {/* Top section - Card name */}
                          <View style={[
                            styles.cardNameContainer,
                            { backgroundColor: shadowTextBackgroundColor }
                          ]}>
                            <Text 
                              style={[
                                styles.cardName, 
                                { 
                                  fontSize: shadowNameFontSize,
                                  color: shadowItem.name_color || '#FFFFFF' 
                                }
                              ]}
                              numberOfLines={1}
                            >
                              {shadowItem.name}
                            </Text>
                          </View>

                          {/* Middle section - Card image */}
                          <View 
                            style={[
                              styles.artContainer,
                              { height: shadowImageHeight }
                            ]}
                          >
                            <Image
                              source={{ uri: shadowItem.image_url }}
                              style={styles.cardArt}
                              resizeMode="cover"
                            />
                          </View>

                          {/* Bottom section - Type line and description */}
                          <View style={{ flex: 1 }}>
                            {/* Type line */}
                            <View style={[
                              styles.typeLine, 
                              { 
                                marginTop: shadowContentPadding,
                                backgroundColor: shadowTextBackgroundColor
                              }
                            ]}>
                              <View style={styles.typeContainer}>
                                <Text 
                                  style={[
                                    styles.typeText, 
                                    { 
                                      fontSize: shadowTypeFontSize,
                                      color: shadowItem.type_color || '#FFFFFF' 
                                    }
                                  ]}
                                >
                                  {shadowItem.type}
                                </Text>
                              </View>
                              
                              {shadowItem.role && (
                                <View style={styles.roleContainer}>
                                  {getCardRoleIcon(shadowItem.role)}
                                  <Text 
                                    style={[
                                      styles.roleText, 
                                      { 
                                        fontSize: Math.max(8, Math.round(14 * scaleFactor)),
                                        color: '#FFFFFF' 
                                      }
                                    ]}
                                  >
                                    {shadowItem.role}
                                  </Text>
                                </View>
                              )}
                            </View>

                            {/* Description */}
                            <View 
                              style={[
                                styles.textBox,
                                { 
                                  marginTop: shadowContentPadding / 2,
                                  flex: 1,
                                  backgroundColor: shadowTextBackgroundColor
                                }
                              ]}
                            >
                              <Text 
                                style={[
                                  styles.cardDescription, 
                                  { 
                                    fontSize: shadowDescriptionFontSize,
                                    lineHeight: Math.max(12, Math.round(shadowDescriptionFontSize * 1.4)),
                                    color: shadowItem.description_color || '#FFFFFF'
                                  }
                                ]}
                                numberOfLines={3}
                              >
                                {shadowItem.description}
                              </Text>
                            </View>

                            {/* Context - at the bottom of the card */}
                            {shadowItem.context && (
                              <View style={[
                                styles.contextContainer, 
                                { 
                                  marginTop: shadowContentPadding / 2,
                                  backgroundColor: shadowTextBackgroundColor
                                }
                              ]}>
                                <Text 
                                  style={[
                                    styles.contextText, 
                                    { 
                                      fontSize: shadowContextFontSize,
                                      color: shadowItem.context_color || '#CCCCCC'
                                    }
                                  ]}
                                >
                                  {shadowItem.context}
                                </Text>
                              </View>
                            )}
                          </View>
                        </LinearGradient>
                      ) : (
                        <View
                          style={[
                            styles.cardContent,
                            { 
                              padding: shadowContentPadding,
                              height: '100%',
                              backgroundColor: shadowTextBackgroundColor,
                            }
                          ]}
                        >
                          {/* Same content structure without gradient wrapper */}
                          <View style={[
                            styles.cardNameContainer,
                            { backgroundColor: shadowTextBackgroundColor }
                          ]}>
                            <Text 
                              style={[
                                styles.cardName, 
                                { 
                                  fontSize: shadowNameFontSize,
                                  color: shadowItem.name_color || '#FFFFFF' 
                                }
                              ]}
                              numberOfLines={1}
                            >
                              {shadowItem.name}
                            </Text>
                          </View>

                          <View 
                            style={[
                              styles.artContainer,
                              { height: shadowImageHeight }
                            ]}
                          >
                            <Image
                              source={{ uri: shadowItem.image_url }}
                              style={styles.cardArt}
                              resizeMode="cover"
                            />
                          </View>

                          {/* Bottom section - Type line and description */}
                          <View style={{ flex: 1 }}>
                            {/* Type line */}
                            <View style={[
                              styles.typeLine, 
                              { 
                                marginTop: shadowContentPadding,
                                backgroundColor: shadowTextBackgroundColor
                              }
                            ]}>
                              <View style={styles.typeContainer}>
                                <Text 
                                  style={[
                                    styles.typeText, 
                                    { 
                                      fontSize: shadowTypeFontSize,
                                      color: shadowItem.type_color || '#FFFFFF' 
                                    }
                                  ]}
                                >
                                  {shadowItem.type}
                                </Text>
                              </View>
                              
                              {shadowItem.role && (
                                <View style={styles.roleContainer}>
                                  {getCardRoleIcon(shadowItem.role)}
                                  <Text 
                                    style={[
                                      styles.roleText, 
                                      { 
                                        fontSize: Math.max(8, Math.round(14 * scaleFactor)),
                                        color: '#FFFFFF' 
                                      }
                                    ]}
                                  >
                                    {shadowItem.role}
                                  </Text>
                                </View>
                              )}
                            </View>

                            {/* Description */}
                            <View 
                              style={[
                                styles.textBox,
                                { 
                                  marginTop: shadowContentPadding / 2,
                                  flex: 1,
                                  backgroundColor: shadowTextBackgroundColor
                                }
                              ]}
                            >
                              <Text 
                                style={[
                                  styles.cardDescription, 
                                  { 
                                    fontSize: shadowDescriptionFontSize,
                                    lineHeight: Math.max(12, Math.round(shadowDescriptionFontSize * 1.4)),
                                    color: shadowItem.description_color || '#FFFFFF'
                                  }
                                ]}
                                numberOfLines={3}
                              >
                                {shadowItem.description}
                              </Text>
                            </View>

                            {/* Context - at the bottom of the card */}
                            {shadowItem.context && (
                              <View style={[
                                styles.contextContainer, 
                                { 
                                  marginTop: shadowContentPadding / 2,
                                  backgroundColor: shadowTextBackgroundColor
                                }
                              ]}>
                                <Text 
                                  style={[
                                    styles.contextText, 
                                    { 
                                      fontSize: shadowContextFontSize,
                                      color: shadowItem.context_color || '#CCCCCC'
                                    }
                                  ]}
                                >
                                  {shadowItem.context}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                    </LinearGradient>
                  );
                }
              } else {
                // Show default card back with Add Shadow button
                return (
                  <LinearGradient
                    colors={['#1e3a8a', '#000000']} // Dark blue to black
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardBackGradient}
                  >
                    <View style={styles.cardBackContent}>
                      <Text style={styles.cardBackTitle}>CARD BACK</Text>
                      <Text style={styles.cardBackSubtitle}>Long press to flip</Text>
                      
                      <TouchableOpacity
                        style={styles.addShadowButton}
                        onPress={() => {
                          router.push({
                            pathname: '/card-creation-new',
                            params: {
                              shadowForCardId: item.id,
                              returnTo: '/(tabs)'
                            }
                          });
                        }}
                      >
                        <Plus size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.addShadowButtonText}>Add Shadow</Text>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                );
              }
            })()
            }
          </Pressable>
        </Animated.View>
      </View>
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
        colors={['#090909', '#090909']}
        style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading your collection...</Text>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient
        colors={['#090909', '#090909']}
        style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>{error}</Text>
      </LinearGradient>
    );
  }

  // Determine orientation
  const isLandscape = screenWidth > screenHeight;

  return (
    <LinearGradient
      colors={['#090909', '#090909']}
      style={styles.container}
      onLayout={onLayoutRootView}>
      {/* Experiment: Removed Spacer to reduce top padding */}
      {/* Top action bar */}
      <View style={styles.topBarContainer}>
        {/* Collection type dropdown */}
        <View style={styles.dropdownButtonContainer}>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={() => setShowTypeMenu(!showTypeMenu)}
          >
            <Text style={styles.topBarButtonText}>
              {COLLECTION_TYPES.find(t => t.id === selectedType)?.name}
            </Text>
          </TouchableOpacity>
          {showTypeMenu && (
            <View style={styles.dropdownMenu}>
              {COLLECTION_TYPES.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedType(type.id);
                    setShowTypeMenu(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedType === type.id && { color: type.color },
                    ]}
                  >
                    {type.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* HIDDEN: View Mode Toggle: Cards vs Decks
        <TouchableOpacity 
          style={[
            styles.topBarButton,
            viewMode === 'decks' && { backgroundColor: '#6366f1' }
          ]}
          onPress={() => {
            const newMode = viewMode === 'cards' ? 'decks' : 'cards';
            setViewMode(newMode);
            // Reset search and phenomena filter when switching modes
            setSearchQuery('');
            setSelectedPhenomena('All');
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          }}
        >
          <Text style={[
            styles.topBarButtonText,
            viewMode === 'decks' && { color: '#ffffff' }
          ]}>
            {viewMode === 'cards' ? 'View Decks' : 'View Cards'}
          </Text>
        </TouchableOpacity>
        */}

        {/* HIDDEN: Phenomena filter - only show in cards mode
        {viewMode === 'cards' && (
          <View style={styles.dropdownButtonContainer}>
            <TouchableOpacity 
              style={styles.topBarButton}
              onPress={() => {
                setShowPhenomenaMenu(!showPhenomenaMenu);
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
            >
              <Text style={styles.topBarButtonText}>
                {selectedPhenomena === 'All' ? 'All Types' : selectedPhenomena}
              </Text>
            </TouchableOpacity>
            
            {showPhenomenaMenu && (
              <View style={styles.dropdownMenu}>
                {phenomenaTypes.map((phenomena) => (
                  <TouchableOpacity
                    key={phenomena}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedPhenomena(phenomena);
                      setShowPhenomenaMenu(false);
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }
                    }}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      selectedPhenomena === phenomena && { color: '#6366f1' }
                    ]}>
                      {phenomena === 'All' ? 'All Types' : phenomena}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
        */}

        {/* Search box */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search cards..."
            placeholderTextColor="#6b7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Guest Mode Banner - only show for anonymous users on personal tab */}
      {isAnonymous && selectedType === 'personal' && (
        <GuestModeBanner />
      )}

      {/* No column selector UI - automatically set based on device type */}
      
      <View style={{ flex: 1 }}>
        <FlatList
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        pagingEnabled={false}
        contentContainerStyle={styles.horizontalListContent}
        style={styles.horizontalList}
        contentInsetAdjustmentBehavior="never"
        scrollsToTop={false}
        bounces={true}
        alwaysBounceVertical={true}
        alwaysBounceHorizontal={false}
        bouncesZoom={false}
        directionalLockEnabled={true}
        disableIntervalMomentum={true}
        snapToInterval={getCardDimensions().cardWidth + 32}
        snapToAlignment="center"
        decelerationRate="fast"
        overScrollMode="never"
        nestedScrollEnabled={false}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          if (showPhenomenaMenu) setShowPhenomenaMenu(false);
          if (showTypeMenu) setShowTypeMenu(false);
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
            colors={["#6366f1"]}
            progressBackgroundColor="#1f2937"
            progressViewOffset={insets.top + 8}
            enabled={true}
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
                onPress={() => {
                  // Navigate directly to card creation with pre-selected phenomena
                  if (selectedPhenomena === 'All') {
                    router.push('/create');
                  } else {
                    router.push({
                      pathname: '/card-creation-new',
                      params: {
                        preselected_type: selectedPhenomena
                      }
                    });
                  }
                }}
              >
                <Text style={styles.createButtonText}>
                  {selectedPhenomena === 'All' 
                    ? 'Create Your First Card' 
                    : `Create Your First ${selectedPhenomena} Card`
                  }
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        />
      </View>

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
            
            {/* Personal cards: Full edit controls */}
            {selectedType === 'personal' && (
              <>
                <TouchableOpacity
                  style={[styles.modalButton, styles.nftButton]}
                  onPress={() => selectedCard && handleMintNFT(selectedCard)}
                  disabled={mintingNFT}
                >
                  {mintingNFT ? (
                    <Text style={styles.modalButtonText}>
                      Minting NFT...
                    </Text>
                  ) : (
                    <>
                      <Wallet size={20} color="#8247E5" />
                      <Text style={styles.modalButtonText}>Mint as NFT</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => selectedCard && handleEdit(selectedCard)}
                >
                  <Edit3 size={20} color="#fff" />
                  <Text style={styles.modalButtonText}>Edit Card</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.shareButton]}
                  onPress={() => selectedCard && handleShareCard(selectedCard)}
                  disabled={sharingCard}
                >
                  {sharingCard ? (
                    <Text style={styles.modalButtonText}>
                      Capturing...
                    </Text>
                  ) : (
                    <>
                      <Share2 size={20} color="#10b981" />
                      <Text style={styles.modalButtonText}>Share Card</Text>
                    </>
                  )}
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
            
            {/* Friends and Public cards: Share, Hide, Favorite */}
            {(selectedType === 'friends' || selectedType === 'public') && selectedCard && (
              <>
                <TouchableOpacity
                  style={[styles.modalButton, styles.shareButton]}
                  onPress={() => handleShareCard(selectedCard)}
                  disabled={sharingCard}
                >
                  {sharingCard ? (
                    <Text style={styles.modalButtonText}>
                      Capturing...
                    </Text>
                  ) : (
                    <>
                      <Share2 size={20} color="#10b981" />
                      <Text style={styles.modalButtonText}>Share Card</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.favoriteButton]}
                  onPress={() => handleFavoriteCard(selectedCard)}
                >
                  <Heart 
                    size={20} 
                    color={favoritedCards.has(selectedCard.id) ? "#ff4444" : "#fbbf24"}
                    fill={favoritedCards.has(selectedCard.id) ? "#ff4444" : "none"}
                  />
                  <Text style={styles.modalButtonText}>
                    {favoritedCards.has(selectedCard.id) ? 'Unfavorite' : 'Favorite'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.hideButton]}
                  onPress={() => handleHideCard(selectedCard)}
                >
                  <X size={20} color="#6b7280" />
                  <Text style={styles.modalButtonText}>Hide Card</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Deck Actions Modal */}
      <Modal
        visible={showDeckActions}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeckActions(false);
          setSelectedDeck(null);
        }}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => {
            setShowDeckActions(false);
            setSelectedDeck(null);
          }}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedDeck?.name || 'Deck'} Options
            </Text>
            
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                if (selectedDeck) {
                  setSelectedDeckForImage(selectedDeck.name);
                  setShowImageModal(true);
                  setShowDeckActions(false);
                }
              }}
            >
              <Upload size={20} color="#10b981" />
              <Text style={styles.modalButtonText}>Manage Cover Image</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                if (selectedDeck) {
                  router.push({
                    pathname: '/deck-detail',
                    params: {
                      phenomenaType: selectedDeck.name
                    }
                  });
                  setShowDeckActions(false);
                  setSelectedDeck(null);
                }
              }}
            >
              <Edit3 size={20} color="#3b82f6" />
              <Text style={styles.modalButtonText}>Edit Deck Details</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.deleteButton]}
              onPress={() => {
                if (selectedDeck) {
                  removeDeck(selectedDeck.name);
                }
              }}
            >
              <Trash2 size={20} color="#ff4444" />
              <Text style={[styles.modalButtonText, styles.deleteText]}>
                Remove Deck
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Deck Image Upload Modal */}
      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowImageModal(false);
          setSelectedDeckForImage(null);
          setImagePrompt('');
        }}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => {
            setShowImageModal(false);
            setSelectedDeckForImage(null);
            setImagePrompt('');
          }}
        >
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDeckForImage} Cover Image
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowImageModal(false);
                  setSelectedDeckForImage(null);
                  setImagePrompt('');
                }}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Current image preview */}
            {selectedDeckForImage && customDeckImages[selectedDeckForImage] && (
              <View style={styles.imagePreview}>
                <Text style={styles.imagePreviewLabel}>Current Image:</Text>
                <Image 
                  source={{ uri: customDeckImages[selectedDeckForImage] }} 
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>
            )}
            
            {/* Image prompt input */}
            <TextInput
              style={styles.promptInput}
              placeholder="Describe the image you want for this deck..."
              placeholderTextColor="#6b7280"
              value={imagePrompt}
              onChangeText={setImagePrompt}
              multiline
              numberOfLines={3}
            />
            
            {/* Action buttons */}
            <View style={styles.imageButtonsContainer}>
              <TouchableOpacity
                style={[styles.modalButton, { flex: 1 }]}
                onPress={handleGenerateDeckImage}
                disabled={generatingImage}
              >
                {generatingImage ? (
                  <Text style={styles.modalButtonText}>Generating...</Text>
                ) : (
                  <>
                    <Wand2 size={20} color="#8b5cf6" />
                    <Text style={styles.modalButtonText}>Generate</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.uploadButton, { flex: 1 }]}
                onPress={handleDeckImageUpload}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <Text style={styles.uploadButtonText}>Uploading...</Text>
                ) : (
                  <>
                    <Upload size={20} color="#6366f1" />
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            
            {/* Remove image button - only show if image exists */}
            {selectedDeckForImage && customDeckImages[selectedDeckForImage] && (
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleRemoveDeckImage}
              >
                <Trash2 size={20} color="#ff4444" />
                <Text style={[styles.modalButtonText, styles.deleteText]}>
                  Remove Image
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Add New Deck Modal */}
      <Modal
        visible={showAddDeck}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAddDeck(false);
          setNewDeckName('');
        }}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => {
            setShowAddDeck(false);
            setNewDeckName('');
          }}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Deck</Text>
            
            <TextInput
              style={styles.deckNameInput}
              placeholder="Enter deck name..."
              placeholderTextColor="#6b7280"
              value={newDeckName}
              onChangeText={setNewDeckName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={addNewDeck}
            />
            
            <View style={styles.imageButtonsContainer}>
              <TouchableOpacity
                style={[styles.uploadButton, { flex: 1 }]}
                onPress={() => {
                  setShowAddDeck(false);
                  setNewDeckName('');
                }}
              >
                <X size={20} color="#6366f1" />
                <Text style={styles.uploadButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { flex: 1 }]}
                onPress={addNewDeck}
              >
                <Check size={20} color="#10b981" />
                <Text style={styles.modalButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090909',
    paddingHorizontal: Platform.OS === 'web' ? 16 : 8,
    paddingBottom: Platform.OS === 'web' ? 16 : 8,
    paddingTop: Platform.OS === 'web' ? 16 : 2,
  },
  // Column selector styles
  columnSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  columnSelectorLabel: {
    color: '#fff',
    marginRight: 8,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  columnButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  columnButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  columnButtonActive: {
    backgroundColor: '#6366f1',
  },
  columnButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  columnButtonTextActive: {
    color: '#fff',
  },
  columnWrapper: {
    justifyContent: 'space-between', // Distribute space between columns
    marginBottom: 16, // Add space below each row
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionTypeContainer: {
    flexDirection: 'row',
    padding: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  collectionTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
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
  listContent: {
    paddingBottom: 16, // Add more bottom padding
    flexGrow: 1,
  },
  card: {
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
    borderColor: '#C0C0C0',
  },
  cardContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  cardNameContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 6,
    borderRadius: 6,
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
    padding: 6,
    borderRadius: 6,
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
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginLeft: 4,
  },
  textBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 6,
  },
  cardDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  contextContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  contextText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    fontStyle: 'italic',
  },
  settingsButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 6,
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
    borderRadius: 16,
    padding: 12,
    width: '80%',
    maxWidth: 400,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
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
  nftButton: {
    backgroundColor: 'rgba(130, 71, 229, 0.2)', // Polygon/Matic purple with transparency
  },
  shareButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)', // Green with transparency
  },
  favoriteButton: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)', // Yellow/gold with transparency
  },
  hideButton: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)', // Gray with transparency
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

  /* --- New top bar styles --- */
  topBarContainer: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 25,
    position: 'relative',
    zIndex: 3000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  topBarButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  topBarButtonText: {
    color: '#fff',
    fontFamily: 'Cinzel-Regular',
    fontSize: 13,
    letterSpacing: 1,
  },
  searchContainer: {
    flex: 1.5,
    marginLeft: 4,
  },
  searchInput: {
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    color: '#fff',
    fontFamily: 'Cinzel-Regular',
    fontSize: 13,
    letterSpacing: 0.5,
    borderWidth: 0,
  },
  dropdownButtonContainer: {
    position: 'relative',
    flex: 1,
    zIndex: 10000,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingVertical: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 20,
    zIndex: 10000,
    gap: 2,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    color: '#fff',
    fontFamily: 'Cinzel-Regular',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  /* ---- Full-bleed card styles ---- */
  fullBleedCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  fullBleedImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  fullBleedName: {
    fontFamily: 'Inter-Bold',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 6, // Space between title and description
    textAlign: 'left',
  },
  fullBleedCorner: {
    position: 'absolute',
    fontFamily: 'Inter-Bold',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  topLeft: { top: 8, left: 8 },
  topRight: { top: 8, right: 8 },
  bottomLeft: { bottom: 8, left: 8 },
  fullBleedDescription: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    fontFamily: 'Inter-Regular',
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cornerTextContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  fullBleedGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 16,
  },
  cornerTextLine: {
    fontFamily: 'Inter-Regular',
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 2,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  horizontalListContent: {
    alignItems: 'center',
    paddingBottom: 100,
  },
  horizontalList: {
    flex: 1,
  },
  cardBack: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
  },
  cardBackGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardBackPressable: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  cardBackContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBackTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 2,
  },
  cardBackSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.7,
    textAlign: 'center',
  },
  addShadowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  addShadowButtonText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  shadowCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  shadowCardContent: {
    alignItems: 'flex-start',
  },
  shadowCardFramedContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  shadowCardName: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  shadowCardDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  deckOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  deckTitle: {
    fontFamily: 'Inter-Bold',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 4,
  },
  deckLabel: {
    fontFamily: 'Inter-Regular',
    color: '#ffffff',
    textAlign: 'center',
    opacity: 0.8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  imagePreview: {
    marginBottom: 16,
  },
  imagePreviewLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  promptInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    marginBottom: 16,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  imageButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  uploadButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonText: {
    color: '#6366f1',
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  deckNameInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    marginBottom: 20,
  },
});