import { View, Text, TextInput, StyleSheet, FlatList, Pressable, Image, Modal, TouchableOpacity, RefreshControl, useWindowDimensions, Platform, PlatformIOSStatic, Dimensions, Alert, Animated, Linking } from 'react-native';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import { Settings2, CreditCard as Edit3, Trash2, Swords, Shield, Sparkles, Users, Globe as Globe2, Lock, Wallet, Plus, Share2 } from 'lucide-react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WalletService } from '@/app/services/walletService';
import { SubtextNftMinter } from '@/app/utils/nftMinter';
import { Network } from 'alchemy-sdk';

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
    user_id: string;
    collection_id?: string;
    collections?: any;
    shadow_card_id?: string;
    shadow_card?: Card | Card[] | null;
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
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
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
  
  // Double tap timing ref
  const lastTapRef = useRef<number>(0);
  
  // Wallet service for NFT minting
  const walletService = useRef(new WalletService()).current;
  
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
              id, name, description, type, role, context, image_url, frame_width, frame_color, 
              name_color, type_color, description_color, context_color, format, background_gradient, 
              is_premium_generation, user_id, collection_id, shadow_card_id,
              shadow_card:shadow_card_id(
                id, name, description, type, role, context, image_url, frame_width, frame_color,
                name_color, type_color, description_color, context_color, format, background_gradient,
                is_premium_generation
              )
            `)
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
            .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, is_premium_generation, user_id, collection_id')
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
              .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, is_premium_generation, user_id, collection_id')
              .eq('is_public', true)
              .order('created_at', { ascending: false })
              .limit(50);

            if (publicError) {
              // If is_public column doesn't exist (error code 42703), fall back to showing cards from other users
              if (publicError.code === '42703' || publicError.message?.includes('is_public') && publicError.message?.includes('does not exist')) {
                console.log('is_public column not found, falling back to showing other users\' cards');
                const { data: fallbackCards, error: fallbackError } = await supabase
                  .from('cards')
                  .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, is_premium_generation, user_id, collection_id')
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
                .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, format, background_gradient, is_premium_generation, user_id, collection_id')
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
        console.error('Error loading phenomena types from database:', dbError);
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
      console.error('Error loading phenomena types:', error);
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
      console.error('Error loading from AsyncStorage:', error);
      // Fallback to default types
      const defaultTypes = ['Intention', 'Context', 'Impact', 'Accuracy', 'Agenda', 'Needs', 'Emotion', 'Role'];
      setPhenomenaTypes(['All', ...defaultTypes]);
    }
  };

  // Filter cards based on selected phenomena type and search query
  const filterCards = useCallback((cardsToFilter: Card[]) => {
    let filtered = cardsToFilter;
    
    // Filter by phenomena type
    if (selectedPhenomena !== 'All') {
      filtered = filtered.filter(card => card.type === selectedPhenomena);
    }
    
    // Filter by search query (card name)
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(card => 
        card.name.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [selectedPhenomena, searchQuery]);

  // Update filtered cards when phenomena selection or search query changes
  useEffect(() => {
    const filteredCards = filterCards(allCards);
    setCards(filteredCards);
  }, [selectedPhenomena, searchQuery, allCards, filterCards]);

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
      console.log('🗑️ Attempting to delete card:', cardId, 'for user:', user.id);
      
      // First, check if this card is being used as a shadow card by other cards
      const { data: referencingCards, error: checkError } = await supabase
        .from('cards')
        .select('id, name')
        .eq('shadow_card_id', cardId)
        .eq('user_id', user.id);

      if (checkError) {
        console.error('Error checking shadow card references:', checkError);
        throw new Error(`Database error: ${checkError.message}`);
      }

      // If this card is used as a shadow card, unlink it first
      if (referencingCards && referencingCards.length > 0) {
        console.log('🔗 Card is used as shadow by:', referencingCards.map(c => c.name).join(', '));
        console.log('🔗 Unlinking shadow card references...');
        
        const { error: unlinkError } = await supabase
          .from('cards')
          .update({ shadow_card_id: null })
          .eq('shadow_card_id', cardId)
          .eq('user_id', user.id);

        if (unlinkError) {
          console.error('Error unlinking shadow card:', unlinkError);
          throw new Error(`Failed to unlink shadow card: ${unlinkError.message}`);
        }

        console.log('✅ Shadow card references unlinked successfully');
      }
      
      // Now delete the card
      const { error: deleteError, data } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId)
        .eq('user_id', user.id)
        .select(); // Add select to see what was deleted

      console.log('Delete response:', { error: deleteError, data });

      if (deleteError) {
        console.error('Supabase delete error:', deleteError);
        throw new Error(`Database error: ${deleteError.message} (Code: ${deleteError.code})`);
      }

      if (!data || data.length === 0) {
        throw new Error('Card not found or you do not have permission to delete it');
      }

      console.log('✅ Card deleted successfully:', data);
      setAllCards(prevCards => prevCards.filter(card => card.id !== cardId));
      setShowActions(false);
      setSelectedCard(null);
      
    } catch (err) {
      console.error('Delete error details:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Final error message:', errorMessage);
      setDeleteError(errorMessage);
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
    
    // Check if wallet is connected
    if (!walletConnected) {
      // Prompt to connect wallet
      Alert.alert(
        'Connect Wallet',
        'To mint this card as an NFT, you need to connect your wallet with MATIC for gas fees.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Learn More', 
            onPress: () => {
              Alert.alert(
                'NFT Minting Setup',
                'To mint NFTs:\n\n1. Add Polygon Mainnet to MetaMask\n2. Get MATIC tokens for gas fees\n3. Connect your wallet\n\nYour NFTs will appear on OpenSea after minting.',
                [{ text: 'OK' }]
              );
            }
          },
          {
            text: 'Connect Wallet',
            onPress: () => connectTestWallet(card)
          }
        ]
      );
      return;
    }
    
    // If wallet is already connected, proceed with minting
    await mintCardAsNFT(card);
  };

  const connectTestWallet = async (card: Card) => {
    Alert.prompt(
      'Connect Wallet',
      'Enter your wallet private key to connect:\n\n⚠️ Keep your private key secure!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: async (privateKey) => {
            if (!privateKey || privateKey.trim() === '') {
              Alert.alert('Error', 'Private key is required');
              return;
            }
            
            setMintingNFT(true);
            try {
              // Remove any 0x prefix if present
              const cleanKey = privateKey.trim().replace(/^0x/, '');
              
              // Connect wallet using private key
              console.log('🔐 Connecting wallet...');
              const network = process.env.EXPO_PUBLIC_BLOCKCHAIN_NETWORK === 'MATIC_MAINNET' ? 'mainnet' : 'amoy';
              const result = await walletService.connectWithPrivateKey(cleanKey, network);
              
              setWalletAddress(result.address);
              setWalletConnected(true);
              setMintingNFT(false);
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              
              Alert.alert(
                'Wallet Connected! ✅',
                `Address: ${result.address.substring(0, 6)}...${result.address.substring(38)}\n\nReady to mint NFT!`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Mint NFT', 
                    onPress: () => mintCardAsNFT(card) 
                  }
                ]
              );
            } catch (error: any) {
              setMintingNFT(false);
              console.error('❌ Connection error:', error);
              Alert.alert(
                'Connection Failed',
                error.message || 'Failed to connect wallet. Check your private key and try again.'
              );
            }
          }
        }
      ],
      'plain-text'
    );
  };

  const mintCardAsNFT = async (card: Card) => {
    setMintingNFT(true);
    
    try {
      // Check environment configuration
      if (!process.env.EXPO_PUBLIC_ALCHEMY_API_KEY ||
          !process.env.EXPO_PUBLIC_PINATA_API_KEY ||
          !process.env.EXPO_PUBLIC_NFT_CONTRACT_ADDRESS) {
        throw new Error('Missing environment variables. Please configure .env file.');
      }
      
      // Get contract address from environment
      const contractAddress = process.env.EXPO_PUBLIC_NFT_CONTRACT_ADDRESS;
      console.log('🔍 Using contract address:', contractAddress);
      
      // Initialize NFT minter
      const nftMinter = new SubtextNftMinter({
        alchemyApiKey: process.env.EXPO_PUBLIC_ALCHEMY_API_KEY,
        pinataApiKey: process.env.EXPO_PUBLIC_PINATA_API_KEY,
        pinataSecretKey: process.env.EXPO_PUBLIC_PINATA_SECRET_KEY || '',
        contractAddress: contractAddress,
        network: process.env.EXPO_PUBLIC_BLOCKCHAIN_NETWORK === 'MATIC_MAINNET' 
          ? Network.MATIC_MAINNET 
          : Network.MATIC_MUMBAI
      });
      
      // Get signer and address from wallet service
      const signer = walletService.getSigner();
      const recipientAddress = walletService.getAddress();
      
      if (!signer || !recipientAddress) {
        throw new Error('Wallet not connected. Please connect your wallet first.');
      }
      
      console.log('💰 Wallet address:', recipientAddress);
      
      // Convert card to format expected by minter
      const subtextCard = {
        id: card.id,
        name: card.name,
        description: card.description || '',
        type: card.type,
        role: card.role,
        context: card.context,
        artStyle: 'Fantasy (MTG-inspired)', // Default art style
        imageUri: card.image_url
      };
      
      console.log('🎴 Starting NFT minting for card:', card.name);
      
      // Mint NFT on blockchain
      const result = await nftMinter.mintSubtextCardNFTs(
        subtextCard,
        signer,
        recipientAddress
      );
      
      if (result.success) {
        // Save mint record to database
        await supabase
          .from('nft_mints')
          .insert({
            user_id: user?.id,
            card_id: card.id,
            transaction_hash: result.imageNftTxHash,
            image_nft_hash: result.imageNftTxHash,
            card_nft_hash: result.cardNftTxHash,
            image_token_id: result.imageTokenId,
            card_token_id: result.cardTokenId,
            contract_address: contractAddress,
            wallet_address: recipientAddress,
            network: process.env.EXPO_PUBLIC_BLOCKCHAIN_NETWORK || 'MATIC_MAINNET',
            status: 'confirmed'
          });
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        const explorerUrl = process.env.EXPO_PUBLIC_BLOCKCHAIN_NETWORK === 'MATIC_MAINNET'
          ? `https://polygonscan.com/tx/${result.imageNftTxHash}`
          : `https://amoy.polygonscan.com/tx/${result.imageNftTxHash}`;
        
        // Construct OpenSea URL - uses mainnet or testnet (Amoy) based on network
        const openSeaUrl = process.env.EXPO_PUBLIC_BLOCKCHAIN_NETWORK === 'MATIC_MAINNET'
          ? `https://opensea.io/assets/matic/${contractAddress}/${result.cardTokenId}`
          : `https://testnets.opensea.io/assets/amoy/${contractAddress}/${result.cardTokenId}`;
        
        Alert.alert(
          'NFT Minted Successfully! 🎉',
          `Your card "${card.name}" has been minted as an NFT.\n\n` +
          `Token ID: ${result.cardTokenId}\n` +
          `Transaction: ${result.imageNftTxHash?.substring(0, 10)}...\n\n` +
          `View it on OpenSea!`,
          [
            { text: 'OK' },
            { 
              text: 'View on Polygonscan', 
              onPress: () => Linking.openURL(explorerUrl)
            },
            { 
              text: 'View on OpenSea', 
              onPress: () => Linking.openURL(openSeaUrl)
            }
          ]
        );
      } else {
        throw new Error(result.error || 'Minting failed');
      }
    } catch (error: any) {
      console.error('❌ Minting error:', error);
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
      console.error('ViewShot ref not found for card:', card.id);
      return;
    }

    setSharingCard(true);
    setShowActions(false); // Close modal first

    try {
      // Give a moment for modal to close
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Capture the specific card as image
      console.log('📸 Capturing card:', card.name, card.id);
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
      console.error('Error sharing card:', error);
      Alert.alert('Error', 'Failed to share card. Please try again.');
    } finally {
      setSharingCard(false);
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
  
  // Calculate card dimensions to fit completely on screen
  const getCardDimensions = () => {
    // Calculate available height (subtract space for top controls and bottom tab bar)
    // Top controls: collection type buttons (~60px) + phenomena filter (~60px) + padding
    // Bottom tab bar: (~80px)
    // Additional padding and margins: (~40px)
    const reservedHeight = 240;
    const availableHeight = screenHeight - reservedHeight;
    
    // Calculate available width (subtract horizontal padding)
    const horizontalPadding = 32; // 16px on each side
    const availableWidth = screenWidth - horizontalPadding;
    
    // Calculate card dimensions based on 2.5:3.5 aspect ratio
    // Try height-constrained first
    let cardHeight = availableHeight;
    let cardWidth = cardHeight * (2.5 / 3.5);
    
    // If width exceeds available space, constrain by width instead
    if (cardWidth > availableWidth) {
      cardWidth = availableWidth;
      cardHeight = cardWidth * (3.5 / 2.5);
    }
    
    // Ensure minimum readable size
    const minCardHeight = 400;
    const minCardWidth = minCardHeight * (2.5 / 3.5);
    
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
          console.error('Error parsing background gradient:', error);
        }
      }
      return null; // No background gradient
    };
    
    const backgroundGradient = getBackgroundGradient();
    
    // Double tap detection for modal - NOW FLIP-STATE AWARE!
    const handleDoubleTapCard = () => {
      const now = Date.now();
      const DOUBLE_PRESS_DELAY = 300;
      if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_PRESS_DELAY) {
        // Determine which card to edit based on current flip state
        let targetCard: Card;
        
        if (!isFlipped) {
          // User is viewing FRONT side → always edit original card
          targetCard = item;
          console.log('🟢 FRONT SIDE DOUBLE TAP - editing original card:', item.name, item.id);
        } else {
          // User is viewing BACK side → edit what's displayed on back
          const shadowCard = item.shadow_card 
            ? (Array.isArray(item.shadow_card) ? item.shadow_card[0] : item.shadow_card)
            : null;
          
          if (shadowCard) {
            // Shadow exists and is displayed → edit shadow
            targetCard = shadowCard;
            console.log('🔵 BACK SIDE DOUBLE TAP (with shadow) - editing shadow card:', shadowCard.name, shadowCard.id);
          } else {
            // No shadow, showing default back → edit original
            targetCard = item;
            console.log('🟡 BACK SIDE DOUBLE TAP (no shadow) - editing original card:', item.name, item.id);
          }
        }
        
        // Double tap detected - show modal for the contextually correct card
        setSelectedCard(targetCard);
        setShowActions(true);
        setDeleteError('');
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } else {
        // Single tap - reserved for future interactions
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
      lastTapRef.current = now;
    };
    
    // Long press handler for animated card flip
    const handleLongPress = () => {
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
      // For premium generation, use completely custom container for clean display
      if (item.is_premium_generation) {
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
              resizeMode="contain" // Use contain for complete trading cards
            />
          </Pressable>
        );
      }
      
      // Regular fullBleed rendering for legacy cards
      return (
        <Pressable
          style={[styles.fullBleedCard, { width: cardWidth, height: cardHeight }]}
          onPress={() => handleDoubleTapCard()}
          onLongPress={handleLongPress}
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



          {/* Hide text overlays for premium generation */}
          {!item.is_premium_generation && item.type ? (
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

          {!item.is_premium_generation && item.role ? (
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

          {/* Hide name and description overlays for premium generation */}
          {!item.is_premium_generation && item.description ? (
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
                  // Render shadow card as full bleed with same layout as normal full bleed
                  return (
                    <>
                      <Image source={{ uri: shadowItem.image_url }} style={styles.fullBleedImage} resizeMode="cover" />

                      {/* Adaptive gradient overlay - same logic as normal full bleed */}
                      {(() => {
                        // Calculate adaptive gradient height based on content
                        const titleLines = shadowItem.name ? Math.ceil(shadowItem.name.length / 20) : 0;
                        const titleHeight = titleLines * shadowNameFontSize * 1.2;
                        const descriptionLines = Math.min(4, Math.ceil((shadowItem.description || '').length / 30));
                        const descriptionHeight = descriptionLines * shadowDescriptionFontSize * 1.4;
                        const padding = 28;
                        const spacing = 6;
                        
                        const totalContentHeight = titleHeight + descriptionHeight + padding + spacing;
                        const adaptiveGradientHeight = Math.max(totalContentHeight + 20, cardHeight * 0.4);
                        
                        return (
                          <LinearGradient
                            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
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

                      {/* Type label in top right */}
                      {shadowItem.type ? (
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

                      {/* Role label in top left */}
                      {shadowItem.role ? (
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

                      {/* Title and description in corner layout */}
                      {shadowItem.description ? (
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
                        shadowItem.name ? (
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
          </View>
        </Pressable>
      </Modal>

      {/* Floating Plus Button for Quick Card Creation */}
      {selectedType === 'personal' && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => {
            // Always route directly to card creation screen
            if (selectedPhenomena === 'All') {
              router.push('/card-creation-new');
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
          <Plus size={14} color="#fff" />
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
  searchContainer: {
    flex: 1,
    marginLeft: 8,
  },
  searchInput: {
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#fff',
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    justifyContent: 'center',
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
});