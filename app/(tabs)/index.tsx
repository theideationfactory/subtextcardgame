import { View, Text, TextInput, StyleSheet, FlatList, Pressable, Image, Modal, TouchableOpacity, RefreshControl, useWindowDimensions, Platform, PlatformIOSStatic, Dimensions, Alert } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import { Settings2, CreditCard as Edit3, Trash2, Swords, Shield, Sparkles, Users, Globe as Globe2, Lock, Wallet, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Spacer } from '@/components/Spacer';
import { isIPad, isTablet, isIPadMini } from '@/utils/deviceDimensions';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    role_color?: string;
    description_color?: string;
    context_color?: string;
    format?: "framed" | "fullBleed";
    background_gradient?: string;
    user_id: string;
    collection_id?: string;
    collections?: any;
  };

  const { width: screenWidth } = useWindowDimensions();

  const getNumColumns = () => {
    // Always use 1 column for phones, even large ones
    if (!isTablet()) {
      return 1;
    }
    // Use more columns for larger screens (tablets), but cap at 2
    const potentialCols = Math.max(1, Math.floor(screenWidth / 200)); // Adjust 200 based on desired min card width
    return Math.min(potentialCols, 2); // Cap at 2 columns for tablets
  };

  const [numColumns, setNumColumns] = useState(getNumColumns());
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [mintingNFT, setMintingNFT] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedType, setSelectedType] = useState<CollectionType>('personal');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [phenomenaTypes, setPhenomenaTypes] = useState<string[]>(['All']);
  const [selectedPhenomena, setSelectedPhenomena] = useState<string>('All');
  const [showPhenomenaMenu, setShowPhenomenaMenu] = useState(false);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const { height: screenHeight } = useWindowDimensions();
  const router = useRouter();
  
  // Calculate scaling factor based on number of columns
  const getScaleFactor = () => {
    switch (numColumns) {
      case 1: return 1.0;      // 100% - original size
      case 2: return 0.7;      // 70% - moderately reduced
      case 3: return 0.5;      // 50% - half size
      case 4: return 0.35;     // 35% - very compact
      default: return 1.0;
    }
  };
  
  // Function to determine column count based on device and orientation
  const getColumnCount = useCallback(() => {
    // Get current dimensions
    const { width, height } = Dimensions.get('window');
    
    // Always use 1 column for phones
    if (!isTablet()) {
      return 1;
    }
    
    // For tablets: explicitly check if width > height for landscape orientation
    const isLandscape = width > height;
    
    // Use 3 columns in landscape, 2 in portrait for tablets
    const columnCount = isLandscape ? 3 : 2;
    
    // Log detailed device info for debugging
    console.log('Device orientation info:', {
      isTablet: isTablet(),
      isIPad: isIPad(),
      isIPadMini: isIPadMini(),
      screenWidth: width,
      screenHeight: height,
      isLandscape: isLandscape,
      columnCount: columnCount
    });
    
    return columnCount;
  }, []);
  
  // Function to update column count when dimensions change
  const updateColumnCount = useCallback(() => {
    const newColumnCount = getColumnCount();
    setNumColumns(newColumnCount);
  }, [getColumnCount]);
  
  // Set up orientation detection and column adjustment
  useEffect(() => {
    // Set initial column count
    updateColumnCount();
    
    // Add event listener for dimension changes
    const dimensionsSubscription = Dimensions.addEventListener('change', updateColumnCount);
    
    // Clean up event listener on unmount
    return () => dimensionsSubscription.remove();
  }, [updateColumnCount]);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
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
            .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, user_id, collection_id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50); // Add reasonable limit

          if (personalError) throw personalError;
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
            .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, user_id, collection_id')
            .in('user_id', friendIds)
            .order('created_at', { ascending: false })
            .limit(50);

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
            console.log('is_public or is_shared_with_friends column not found, using basic friend filter');
          }

          const { data: friendCards, error: friendCardsError } = await friendCardsQuery;

          if (friendCardsError) throw friendCardsError;
          setAllCards(friendCards as Card[] || []);
          break;

        case 'public':
          try {
            // First try with is_public column (if migration has been run)
            const { data: publicCards, error: publicError } = await supabase
              .from('cards')
              .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, user_id, collection_id')
              .eq('is_public', true)
              .order('created_at', { ascending: false })
              .limit(50);

            if (publicError) {
              // If is_public column doesn't exist (error code 42703), fall back to showing cards from other users
              if (publicError.code === '42703' || publicError.message?.includes('is_public') && publicError.message?.includes('does not exist')) {
                console.log('is_public column not found, falling back to showing other users\' cards');
                const { data: fallbackCards, error: fallbackError } = await supabase
                  .from('cards')
                  .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, user_id, collection_id')
                  .neq('user_id', user.id)
                  .order('created_at', { ascending: false })
                  .limit(50);

                if (fallbackError) throw fallbackError;
                setAllCards(fallbackCards as Card[] ?? []);
                break; // Important: break here to avoid throwing the error
              } else {
                throw publicError;
              }
            } else {
              setAllCards(publicCards as Card[] ?? []);
            }
          } catch (publicErr: any) {
            // Check if this is the column not found error one more time
            if (publicErr.code === '42703' || (publicErr.message?.includes('is_public') && publicErr.message?.includes('does not exist'))) {
              console.log('Caught is_public column error in catch block, using fallback');
              const { data: fallbackCards, error: fallbackError } = await supabase
                .from('cards')
                .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, user_id, collection_id')
                .neq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

              if (fallbackError) throw fallbackError;
              setAllCards(fallbackCards as Card[] ?? []);
            } else {
              console.error('Public cards query error:', publicErr);
              throw publicErr;
            }
          }
          break;
      }
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

  // Load phenomena types on component mount
  useEffect(() => {
    loadPhenomenaTypes();
  }, []);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCards(true);
  }, [fetchCards]);

  // Load phenomena types from AsyncStorage
  const loadPhenomenaTypes = async () => {
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
      console.error('Error loading phenomena types:', error);
      // Fallback to default types
      const defaultTypes = ['Intention', 'Context', 'Impact', 'Accuracy', 'Agenda', 'Needs', 'Emotion', 'Role'];
      setPhenomenaTypes(['All', ...defaultTypes]);
    }
  };

  // Filter cards based on selected phenomena type
  const filterCardsByPhenomena = useCallback((cardsToFilter: Card[]) => {
    if (selectedPhenomena === 'All') {
      return cardsToFilter;
    }
    return cardsToFilter.filter(card => card.type === selectedPhenomena);
  }, [selectedPhenomena]);

  // Update filtered cards when phenomena selection changes
  useEffect(() => {
    const filteredCards = filterCardsByPhenomena(allCards);
    setCards(filteredCards);
  }, [selectedPhenomena, allCards, filterCardsByPhenomena]);

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

      setAllCards(prevCards => prevCards.filter(card => card.id !== cardId));
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
    // Close modal
    setShowActions(false);
    
    // Navigate to Edit page
    router.push({
      pathname: '/card-creation-new',
      params: {
        id: card.id,
        name: card.name,
        description: card.description,
        type: card.type,
        role: card.role || '',
        context: card.context || '',
        image_url: card.image_url,
        frame_color: card.frame_color || '',
        name_color: card.name_color || '',
        type_color: card.type_color || '',
        description_color: card.description_color || '',
        context_color: card.context_color || '',
        edit_mode: 'true'
      }
    });
  };

  const handleMintNFT = (card: Card) => {
    // Close the settings modal
    setShowActions(false);
    
    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Check if wallet is connected
    if (!walletConnected) {
      // Prompt to connect wallet
      Alert.alert(
        'Wallet Not Connected',
        'You need to connect a wallet to mint this card as an NFT.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Connect Wallet', 
            onPress: () => {
              // Simulate wallet connection for demo
              setMintingNFT(true);
              
              setTimeout(() => {
                const mockWalletAddress = '0x' + Math.random().toString(16).substring(2, 42);
                setWalletAddress(mockWalletAddress);
                setWalletConnected(true);
                setMintingNFT(false);
                
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                  'Wallet Connected',
                  `Connected to wallet: ${mockWalletAddress.substring(0, 6)}...${mockWalletAddress.substring(38)}`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Mint NFT', 
                      onPress: () => mintCardAsNFT(card) 
                    }
                  ]
                );
              }, 1500);
            }
          }
        ]
      );
      return;
    }
    
    // If wallet is already connected, proceed with minting
    mintCardAsNFT(card);
  };

  const mintCardAsNFT = (card: Card) => {
    setMintingNFT(true);
    
    // This is a simulation of the minting process
    // In a production app, you would call your NFT minting function here
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMintingNFT(false);
      
      Alert.alert(
        'NFT Minted Successfully!',
        `Your card "${card.name}" has been minted as an NFT and will soon appear in your wallet.`,
        [{ text: 'OK' }]
      );
    }, 3000);
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
  
  // Calculate card dimensions based on traditional trading card ratio (2.5:3.5)
  const getCardDimensions = () => {
    // Base width depends on screen width and number of columns
    const cardWidth = (screenWidth / numColumns) - (24 * numColumns); // Account for margins
    
    // Calculate height based on the 2.5:3.5 ratio (7:5 height:width)
    const cardHeight = cardWidth * (3.5 / 2.5);
    
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
          console.error('Error parsing background gradient:', error);
        }
      }
      return null; // No background gradient
    };
    
    const backgroundGradient = getBackgroundGradient();
    
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
    
    // If the card uses the full-bleed format, render it with edge-to-edge art and text overlays
    if (item.format === 'fullBleed') {
      return (
        <Pressable
          style={[styles.fullBleedCard, { width: cardWidth, height: cardHeight }]}
          onPress={() => {
            setSelectedCard(item);
            setShowActions(true);
            setDeleteError('');
          }}
        >
          <Image source={{ uri: item.image_url }} style={styles.fullBleedImage} resizeMode="cover" />

          {/* Adaptive gradient overlay */}
          {(() => {
            // Calculate adaptive gradient height based on content
            const titleLines = item.name ? Math.ceil(item.name.length / 20) : 0; // Rough estimate of title lines
            const titleHeight = titleLines * nameFontSize * 1.2; // Line height factor
            const descriptionLines = Math.min(4, Math.ceil(item.description.length / 30)); // Estimate description lines
            const descriptionHeight = descriptionLines * descriptionFontSize * 1.4;
            const padding = 28; // Top and bottom padding
            const spacing = 6; // Space between title and description
            
            // Calculate total content height
            const totalContentHeight = titleHeight + descriptionHeight + padding + spacing;
            
            // Ensure gradient covers at least the content area plus some buffer
            const adaptiveGradientHeight = Math.max(totalContentHeight + 20, cardHeight * 0.4);
            
            // Calculate gradient start position (where title should begin)
            const gradientStartFromBottom = totalContentHeight;
            
            return (
              <LinearGradient
                colors={[ 'rgba(0,0,0,0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.75)' ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[
                  styles.fullBleedGradient, 
                  { 
                    height: adaptiveGradientHeight,
                    bottom: 0
                  }
                ]}
                pointerEvents="none"
              />
            );
          })()}



          {item.type ? (
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

          {item.role ? (
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

          {item.description ? (
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
          }
        ]}
        onPress={() => {
          setSelectedCard(item);
          setShowActions(true);
          setDeleteError('');
        }}
      >
        <LinearGradient
          colors={cardColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.cardFrame,
            { 
              borderWidth: borderWidth,
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
              {/* Top section - Card name */}
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

              {/* Bottom section - Type line and description (50% of card height) */}
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
              {/* Top section - Card name */}
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

              {/* Bottom section - Type line and description (50% of card height) */}
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
            </View>
          )}
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

  // Determine orientation
  const isLandscape = screenWidth > screenHeight;

  return (
    <LinearGradient
      colors={['#1a1a1a', '#2a2a2a']}
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

        {/* Phenomena filter dropdown */}
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
              {selectedPhenomena === 'All' ? 'All Decks' : selectedPhenomena}
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
                    {phenomena === 'All' ? 'All Decks' : phenomena}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Search box placeholder */}
        <View style={[styles.searchBox, styles.buttonDisabled]}>
          <Text style={styles.searchPlaceholder}>Search</Text>
        </View>
      </View>

      {/* No column selector UI - automatically set based on device type */}
      
      <TouchableOpacity 
        style={{ flex: 1 }}
        activeOpacity={1}
        onPress={() => {
          if (showPhenomenaMenu) {
            setShowPhenomenaMenu(false);
          }
        }}
      >
        <FlatList
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        numColumns={numColumns} // Use state variable here
        key={numColumns} // Force re-render when numColumns changes
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : null} // Add spacing between columns
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
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
      </TouchableOpacity>

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

      {/* Floating Plus Button for Quick Card Creation */}
      {selectedType === 'personal' && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => {
            // Same smart navigation logic as the "Create Your First Card" button
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
            
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          }}
        >
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: Platform.OS === 'web' ? 16 : 8,
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
    paddingHorizontal: 16,
    marginBottom: 12,
    position: 'relative',
    zIndex: 3000,
  },
  topBarButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  topBarButtonText: {
    color: '#fff',
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  searchBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  searchPlaceholder: {
    color: '#777',
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  dropdownButtonContainer: {
    position: 'relative',
    flex: 1,
    zIndex: 10000,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26,26,26,0.95)',
    borderRadius: 12,
    paddingVertical: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 20,
    zIndex: 10000,
    gap: 4,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    color: '#fff',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  /* ---- Full-bleed card styles ---- */
  fullBleedCard: {
    marginVertical: 16, // Add vertical spacing
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
    width: 56,
    height: 56,
    borderRadius: 28,
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
  }
});