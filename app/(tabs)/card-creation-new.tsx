import { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView,
  StyleSheet, 
  TextInput,
  Switch,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Custom debounce implementation to avoid lodash dependency
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
import { ArrowLeft, Wand2, ChevronDown, ChevronUp, Lock, Users, Globe2, Check, Plus, Edit, PlusCircle, Upload } from 'lucide-react-native';

SplashScreen.preventAutoHideAsync();

// Supabase client is already imported from @/lib/supabase

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop';
const DEFAULT_FRAME_COLOR = '#808080'; // Medium gray

// Background gradient options
const GRADIENT_OPTIONS = [
  { name: 'Shadow Storm', colors: ['#6b7280', '#000000'] },
  { name: 'Deep Violet', colors: ['#8b5cf6', '#1e1b4b'] },
  { name: 'Abyss Blue', colors: ['#3b82f6', '#0c1e33'] },
  { name: 'Molten Fire', colors: ['#dc2626', '#7f1d1d'] },
  { name: 'Dark Forest', colors: ['#16a34a', '#14532d'] }
];

export default function CardCreationNewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditing = !!params.id;

  // Initialize state with params or defaults
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [type, setType] = useState('Intention');
  const [role, setRole] = useState('');
  const [context, setContext] = useState('TBD');
  const [cardImage, setCardImage] = useState('');
  const [format, setFormat] = useState<'framed' | 'fullBleed'>('framed');
  const [backgroundGradient, setBackgroundGradient] = useState<string[]>(['#1a1a1a', '#000000']); // Default black gradient
  
  // Get return parameters for navigation
  const returnTo = params.returnTo as string | undefined;
  const returnZone = params.zone as string | undefined;
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingImageDescription, setIsGeneratingImageDescription] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [authChecking, setAuthChecking] = useState(false);
  
  // Collapsible section states
  const [visibility, setVisibility] = useState<string[]>(['personal']);
  const [showVisibility, setShowVisibility] = useState(false);


  
  // Dropdown states
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  
  // Chat functionality states
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{id: string, role: 'user' | 'assistant', content: string, imageUrl?: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [currentResponseId, setCurrentResponseId] = useState<string | null>(null);
  
  // Dropdown options - loaded from AsyncStorage to include custom phenomena types
  const [typeOptions, setTypeOptions] = useState(['Intention', 'Context', 'Impact', 'Accuracy', 'Agenda', 'Needs', 'Emotion', 'Role']);
  // Map of detail options for each Phenomena
  const subOptionsMap: Record<string, string[]> = {
    Intention: ['Impact', 'Request', 'Protect', 'Connect'],
    Role: ['Advisor', 'Confessor', 'Judge', 'Peacemaker', 'Provocateur', 'Entertainer', 'Gatekeeper'],
    Context: ['Setting', 'Timing', 'Relationship', 'Power'],
    Impact: ['Very Positive', 'Slightly Positive', 'Neutral', 'Slightly Negative', 'Very Negative'],
    Accuracy: ['Veridical', 'Mostly True', 'Distorted', 'Completely Off-Base', 'Manipulative'],
    Needs: ['Connection', 'Autonomy', 'Safety', 'Meaning', 'Play', 'Rest'],
    Emotion: ['Joy', 'Anger', 'Fear', 'Sadness', 'Surprise', 'Disgust', 'Love'],
  };

  const roleOptions = useMemo(() => subOptionsMap[type] || [], [type]);
  const contextOptions = ['TBD', 'Self', 'Family', 'Friendship', 'Therapy', 'Peer', 'Work', 'Art', 'Politics'];


  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  // Get auth context at component level
  const { refreshSession, user } = useAuth();

  const resetForm = () => {
    setName('');
    setDescription('');
    setImageDescription('');
    setType('Intention');
    setRole('');
    setContext('TBD');
    setCardImage('');
    setFormat('framed');
    setVisibility(['personal']);

    
    // Reset loading/error/success states
    setIsGenerating(false);
    setIsGeneratingDescription(false);
    setIsGeneratingImageDescription(false);
    setIsCreating(false);
    setError('');
    setErrorDetails('');
    setSuccessMessage('');

    // Reset UI states
    setShowVisibility(false);
    setShowTypeDropdown(false);
    setShowRoleDropdown(false);
    setShowContextDropdown(false);
  };

  // Load phenomena types from database, fallback to AsyncStorage
  const loadPhenomenaTypes = async () => {
    try {
      if (!user) {
        console.log('No user found, using default phenomena types');
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
        console.log('Loaded custom phenomena types from database:', userData.custom_phenomena_types);
        setTypeOptions(userData.custom_phenomena_types);
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
        console.log('Loaded custom phenomena types from AsyncStorage:', parsedPhenomena);
        setTypeOptions(parsedPhenomena);
      } else {
        console.log('No custom phenomena types found, using defaults');
      }
    } catch (error) {
      console.error('Error loading from AsyncStorage:', error);
      // Keep default types if loading fails
    }
  };

  // Reset form state when the screen is focused for creating a new card
  useFocusEffect(
    useCallback(() => {
      // We only reset if we are not in edit mode.
      // This ensures that when a user navigates away and back,
      // they get a fresh form instead of the old state.
      if (!isEditing) {
        resetForm();
        
        // After resetting, check if we have a preselected type to restore
        if (params.preselected_type) {
          setType(params.preselected_type.toString());
        }
      }
    }, [isEditing, params.preselected_type])
  );

  // Use useEffect to properly set the state values from params
  useEffect(() => {
    if (params.id) {
      console.log('Loading edit data for card:', params.id);
      setName(params.name?.toString() || '');
      setDescription(params.description?.toString() || '');
      setType(params.type?.toString() || '');
      setRole(params.role?.toString() || '');
      setContext(params.context?.toString() || '');
      setCardImage(params.image_url?.toString() || '');
      
      // Load visibility settings
      const loadVisibilitySettings = async () => {
        try {
          // Fetch the card from the database to get the actual visibility settings and background gradient
          const { data: cardData, error } = await supabase
            .from('cards')
            .select('is_public, is_shared_with_friends, background_gradient')
            .eq('id', params.id)
            .single();
          
          if (error) {
            console.error('Error fetching card visibility settings:', error);
            return;
          }
          
          if (cardData) {
            // Set visibility based on the actual database values
            const visibilitySettings = ['personal']; // Always include personal
            
            if (cardData.is_shared_with_friends) {
              visibilitySettings.push('friends');
            }
            
            if (cardData.is_public) {
              visibilitySettings.push('public');
            }
            
            console.log('Setting visibility to:', visibilitySettings);
            setVisibility(visibilitySettings);
            
            // Load background gradient if it exists
            if (cardData.background_gradient) {
              try {
                const gradient = JSON.parse(cardData.background_gradient);
                setBackgroundGradient(gradient);
                console.log('Loaded background gradient:', gradient);
              } catch (err) {
                console.error('Error parsing background gradient:', err);
                // Keep default gradient if parsing fails
              }
            }
          }
        } catch (err) {
          console.error('Failed to load visibility settings:', err);
        }
      };
      
      loadVisibilitySettings();
      
      // Log the loaded data for debugging
      console.log('Card data loaded successfully for editing');
    }
  }, [params.id, params.name, params.description, params.type, params.role, params.context, params.image_url]);

  // Handle preselected phenomena type for new cards
  useEffect(() => {
    if (params.preselected_type && !params.id) {
      // Only set preselected type for new cards (not editing)
      const preselectedType = params.preselected_type.toString();
      setType(preselectedType);
    }
  }, [params.preselected_type, params.id]);

  // Check auth status on component mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setAuthChecking(true);
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          // console.log('No active session found on component mount');
        } else {
          // console.log('Active session found on component mount');
        }
      } catch (err: unknown) {
        console.error('Error checking auth status:', err);
      } finally {
        setAuthChecking(false);
      }
    };
    
    checkAuthStatus();
  }, []);

  // Load phenomena types on component mount
  useEffect(() => {
    loadPhenomenaTypes();
  }, []);

  // Also reload phenomena types when screen is focused (in case they were updated in deck creation)
  useFocusEffect(
    useCallback(() => {
      loadPhenomenaTypes();
    }, [])
  );

  if (!fontsLoaded) {
    return null;
  }

  const generateImage = async () => {
    if (!name) {
      setError('Please provide a card name');
      return;
    }

    if (!imageDescription) {
      setError('Please provide an image description');
      return;
    }
    
    setIsGenerating(true);
    setError('');
    setErrorDetails('');

    try {
      setAuthChecking(true);
      
      const currentSession = await refreshSession();
      
      if (!currentSession || !currentSession.access_token) {
        console.error('No valid session found after refresh attempt');
        throw new Error('You must be logged in to generate images');
      }
      
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-card-image`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description: imageDescription,

            userId: currentSession.user.id
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error response:', errorData);
        setError(errorData.error || `Failed to generate image: ${response.status}`);
        setErrorDetails(errorData.details || `Server responded with status: ${response.status}`);
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const data = await response.json();

      if (!data.imageUrl) {
        console.error('No image URL in response:', data);
        throw new Error('No image URL received');
      }

      setCardImage(data.imageUrl);
    } catch (err) {
      console.error('Image generation error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsGenerating(false);
      setAuthChecking(false);
    }
  };

  // Chat functionality functions
  const initializeChat = () => {
    if (cardImage) {
      const initialMessage = {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: "I've generated your card image! How would you like to refine or modify it? You can ask me to adjust colors, style, composition, or any other aspect.",
        imageUrl: cardImage
      };
      setChatMessages([initialMessage]);
      setShowChat(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: chatInput.trim()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const currentSession = await refreshSession();
      
      if (!currentSession || !currentSession.access_token) {
        throw new Error('You must be logged in to use chat');
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/chat-image-generation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: chatInput.trim(),
            cardImageUrl: cardImage,
            cardName: name,
            originalDescription: imageDescription || name,

          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process chat message');
      }

      const data = await response.json();
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: data.message || "I've updated your image based on your request.",
        imageUrl: data.imageUrl
      };

      setChatMessages(prev => [...prev, assistantMessage]);
      
      if (data.imageUrl) {
        setCardImage(data.imageUrl);
      }

    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const closeChat = () => {
    setShowChat(false);
    setChatMessages([]);
    setCurrentResponseId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const uploadImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to upload images.'
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // No aspect ratio constraint - allow original proportions
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        // Set loading state
        setIsGenerating(true);
        setError('');
        
        try {
          // Get current session with better error handling
          const currentSession = await refreshSession();
          
          if (!currentSession?.user?.id) {
            throw new Error('Authentication required. Please log in again.');
          }

          console.log('Starting image upload for user:', currentSession.user.id);

          // Generate unique filename
          const timestamp = Date.now();

          // Create file object for React Native upload (no blob conversion needed)
          const fileExtension = imageUri.split('.').pop() || 'jpg';
          const mimeType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
          
          // For React Native, create a file-like object
          const file = {
            uri: imageUri,
            type: mimeType,
            name: `uploaded_${timestamp}.${fileExtension}`,
          } as any;
          const fileName = `${currentSession.user.id}/uploaded_${timestamp}.${fileExtension}`;
          
          console.log('Uploading file:', fileName, 'with type:', mimeType);
          
          // Upload to Supabase Storage with better error handling
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('card_images')
            .upload(fileName, file, {
              contentType: mimeType,
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            
            // Handle specific error types
            if (uploadError.message?.includes('JWT')) {
              throw new Error('Authentication expired. Please log in again.');
            } else if (uploadError.message?.includes('policy')) {
              throw new Error('Permission denied. Please check your account settings.');
            } else {
              throw new Error(`Upload failed: ${uploadError.message}`);
            }
          }

          console.log('Upload successful:', uploadData);

          // Get the public URL
          const { data: { publicUrl } } = supabase.storage
            .from('card_images')
            .getPublicUrl(fileName);

          if (!publicUrl) {
            throw new Error('Failed to generate public URL for uploaded image');
          }

          console.log('Generated public URL:', publicUrl);

          // Set the uploaded image URL
          setCardImage(publicUrl);
          
          // Show success feedback
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          
          console.log('Image upload completed successfully');
          
        } catch (uploadErr) {
          console.error('Image upload error:', uploadErr);
          
          // Provide more specific error messages
          let errorMessage = 'Failed to upload image. Please try again.';
          
          if (uploadErr instanceof Error) {
            if (uploadErr.message.includes('Authentication') || uploadErr.message.includes('JWT')) {
              errorMessage = 'Please log in again and try uploading.';
            } else if (uploadErr.message.includes('Permission') || uploadErr.message.includes('policy')) {
              errorMessage = 'Upload permission denied. Please contact support.';
            } else if (uploadErr.message.includes('network') || uploadErr.message.includes('fetch')) {
              errorMessage = 'Network error. Please check your connection and try again.';
            } else {
              errorMessage = uploadErr.message;
            }
          }
          
          setError(errorMessage);
        } finally {
          setIsGenerating(false);
        }
      }
    } catch (err) {
      console.error('Image picker error:', err);
      setError('Failed to access image library. Please try again.');
      setIsGenerating(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!name) {
      setError('Please provide a card name');
      return;
    }

    setIsGeneratingDescription(true);
    setError('');
    setErrorDetails('');

    try {
      const currentSession = await refreshSession();
      
      if (!currentSession || !currentSession.access_token) {
        throw new Error('You must be logged in to generate a description');
      }

      const { data, error } = await supabase.functions.invoke('generate-card-description', {
        body: { 
          cardName: name,
          cardType: type !== 'TBD' ? type : undefined
        },
      });

      if (error) {
        throw new Error(`API Error: ${error.message}`);
      }

      if (!data || !data.description) {
        throw new Error('No description was generated');
      }
      
      setDescription(data.description);
    } catch (err) {
      console.error('Description generation error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleGenerateImageDescription = async () => {
    if (!name) {
      setError('Please provide a card name');
      return;
    }

    setIsGeneratingImageDescription(true);
    setError('');
    setErrorDetails('');

    try {
      const currentSession = await refreshSession();
      
      if (!currentSession || !currentSession.access_token) {
        throw new Error('You must be logged in to generate an image description');
      }

      const { data, error } = await supabase.functions.invoke('generate-image-description', {
        body: { 
          cardName: name,
          cardType: type !== 'TBD' ? type : undefined,
          cardDescription: description || undefined
        },
      });

      if (error) {
        throw new Error(`API Error: ${error.message}`);
      }

      if (!data || !data.imageDescription) {
        throw new Error('No image description was generated');
      }
      
      setImageDescription(data.imageDescription);
    } catch (err) {
      console.error('Image description generation error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsGeneratingImageDescription(false);
    }
  };



  const handleSave = async () => {
    if (!name) {
      setError('Please provide a card name');
      return;
    }

    if (!cardImage) {
      setError('Please generate or provide an image');
      return;
    }

    if (visibility.length === 0) {
      setError('Please select at least one visibility option');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const currentSession = await refreshSession();
      
      if (!currentSession) {
        throw new Error('You must be logged in to create cards');
      }

      const { data: existingCollections, error: collectionError } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', currentSession.user.id)
        .contains('visibility', visibility)
        .limit(1);

      if (collectionError) throw collectionError;

      let collectionId;

      if (existingCollections && existingCollections.length > 0) {
        collectionId = existingCollections[0].id;
      } else {
        const { data: newCollection, error: createCollectionError } = await supabase
          .from('collections')
          .insert({
            name: 'My Collection',
            user_id: currentSession.user.id,
            visibility: visibility
          })
          .select('id')
          .single();

        if (createCollectionError) throw createCollectionError;
        collectionId = newCollection.id;
      }

      const isPublic = visibility.includes('public');
      const isSharedWithFriends = visibility.includes('friends');
      
      const cardData = {
        name,
        description: description || '',
        type: type || 'Card',
        phenomena: type || null,
        role: role || 'General',
        context: context || 'Fantasy',
        image_url: cardImage,
        format,
        frame_color: DEFAULT_FRAME_COLOR,
        // Only save background gradient if user selected something other than default black
        ...(JSON.stringify(backgroundGradient) !== JSON.stringify(['#1a1a1a', '#000000']) && {
          background_gradient: JSON.stringify(backgroundGradient)
        }),
        user_id: currentSession.user.id,
        collection_id: collectionId,
        is_public: isPublic,
        is_shared_with_friends: isSharedWithFriends
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('cards')
          .update(cardData)
          .eq('id', params.id)
          .eq('user_id', currentSession.user.id);

        if (updateError) throw updateError;
        
        setSuccessMessage('Card updated successfully!');
        setTimeout(() => {
          setSuccessMessage('');
          router.replace('/');
        }, 1500);
      } else {
        console.log('Creating new card with data:', cardData);
        const { data: newCard, error: insertError } = await supabase
          .from('cards')
          .insert(cardData)
          .select()
          .single();

        if (insertError) {
          console.error('Card creation error:', insertError);
          throw insertError;
        }
        
        console.log('Card created successfully:', newCard);
        resetForm();
        
        setSuccessMessage('Card created successfully!');
        setTimeout(() => {
          setSuccessMessage('');
          if (returnTo === 'spread' && returnZone) {
            console.log('Navigating back to spread with card ID:', newCard?.id, 'and zone:', returnZone);
            router.replace({
              pathname: '/spread',
              params: { 
                autoAddCardData: JSON.stringify(newCard),
                autoAddZone: returnZone
              }
            });
          } else {
            router.replace('/');
          }
        }, 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Card operation error:', err);
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Navigate specifically to the create tab
    router.push('/(tabs)/create');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Card' : 'Create Card'}</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Card Name <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter card name"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Card Description <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter card description"
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity 
              style={[styles.generateButton, styles.descriptionButton, (!name || isGeneratingDescription) && styles.generateButtonDisabled]} 
              onPress={handleGenerateDescription}
              disabled={!name || isGeneratingDescription}
            >
              {isGeneratingDescription ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Wand2 size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.generateButtonText}>Generate Description</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Image Description <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the image you want to generate"
              placeholderTextColor="#666"
              value={imageDescription}
              onChangeText={setImageDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity 
              style={[styles.generateButton, styles.descriptionButton, (!name || isGeneratingImageDescription) && styles.generateButtonDisabled]} 
              onPress={handleGenerateImageDescription}
              disabled={!name || isGeneratingImageDescription}
            >
              {isGeneratingImageDescription ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Wand2 size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.generateButtonText}>Generate Image Description</Text>
                </>
              )}
            </TouchableOpacity>
            

          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phenomena</Text>
            <TouchableOpacity 
              style={styles.dropdownSelector}
              onPress={() => setShowTypeDropdown(true)}
            >
              <Text style={[styles.dropdownText, !type && styles.placeholderText]}>
                {type || 'Select phenomena'}
              </Text>
              <ChevronDown size={20} color="#666" />
            </TouchableOpacity>
            
            <Modal
              visible={showTypeDropdown}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowTypeDropdown(false)}
            >
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowTypeDropdown(false)}
              >
                <View style={styles.dropdownModal}>
                  <FlatList
                    data={typeOptions}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setType(item);
                          setRole('');
                          setShowTypeDropdown(false);
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{item}</Text>
                        {type === item && <Check size={20} color="#6366f1" />}
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phenomena Detail</Text>
            <TouchableOpacity 
              style={styles.dropdownSelector}
              onPress={() => setShowRoleDropdown(true)}
            >
              <Text style={[styles.dropdownText, !role && styles.placeholderText]}>
                {role || 'Select detail'}
              </Text>
              <ChevronDown size={20} color="#666" />
            </TouchableOpacity>
            
            <Modal
              visible={showRoleDropdown}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowRoleDropdown(false)}
            >
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowRoleDropdown(false)}
              >
                <View style={styles.dropdownModal}>
                  <FlatList
                    data={roleOptions}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setRole(item);
                          setShowRoleDropdown(false);
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{item}</Text>
                        {role === item && <Check size={20} color="#6366f1" />}
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Context</Text>
            <TouchableOpacity 
              style={styles.dropdownSelector}
              onPress={() => setShowContextDropdown(true)}
            >
              <Text style={[styles.dropdownText, !context && styles.placeholderText]}>
                {context || 'Select context'}
              </Text>
              <ChevronDown size={20} color="#666" />
            </TouchableOpacity>
            
            <Modal
              visible={showContextDropdown}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowContextDropdown(false)}
            >
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowContextDropdown(false)}
              >
                <View style={styles.dropdownModal}>
                  <FlatList
                    data={contextOptions}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setContext(item);
                          setShowContextDropdown(false);
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{item}</Text>
                        {context === item && <Check size={20} color="#6366f1" />}
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Background Color</Text>
            <View style={styles.gradientOptionsContainer}>
              {GRADIENT_OPTIONS.map((gradient, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.gradientOption,
                    JSON.stringify(backgroundGradient) === JSON.stringify(gradient.colors) && styles.gradientOptionSelected
                  ]}
                  onPress={() => {
                    setBackgroundGradient(gradient.colors);
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                  }}
                >
                  <LinearGradient
                    colors={gradient.colors as [string, string, ...string[]]}
                    style={styles.gradientPreview}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Text style={styles.gradientName}>{gradient.name}</Text>
                  {JSON.stringify(backgroundGradient) === JSON.stringify(gradient.colors) && (
                    <Check size={20} color="#6366f1" style={styles.gradientCheck} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Visibility Settings</Text>
            <View style={styles.visibilityOptions}>
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility.includes('personal') && styles.visibilityOptionSelected,
                ]}
                onPress={() => {
                  if (!visibility.includes('personal')) {
                    setVisibility([...visibility, 'personal']);
                  } else if (visibility.length > 1) {
                    setVisibility(visibility.filter(v => v !== 'personal'));
                  }
                }}
              >
                <Lock size={20} color={visibility.includes('personal') ? '#6366f1' : '#666'} />
                <Text style={[
                  styles.visibilityText,
                  visibility.includes('personal') && styles.visibilityTextSelected
                ]}>Personal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility.includes('friends') && styles.visibilityOptionSelected,
                ]}
                onPress={() => {
                  if (!visibility.includes('friends')) {
                    setVisibility([...visibility, 'friends']);
                  } else {
                    setVisibility(visibility.filter(v => v !== 'friends'));
                  }
                }}
              >
                <Users size={20} color={visibility.includes('friends') ? '#ec4899' : '#666'} />
                <Text style={[
                  styles.visibilityText,
                  visibility.includes('friends') && styles.visibilityTextSelected
                ]}>Friends</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility.includes('public') && styles.visibilityOptionSelected,
                ]}
                onPress={() => {
                  if (!visibility.includes('public')) {
                    setVisibility([...visibility, 'public']);
                  } else {
                    setVisibility(visibility.filter(v => v !== 'public'));
                  }
                }}
              >
                <Globe2 size={20} color={visibility.includes('public') ? '#10b981' : '#666'} />
                <Text style={[
                  styles.visibilityText,
                  visibility.includes('public') && styles.visibilityTextSelected
                ]}>Public</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.cardPreview, format === 'fullBleed' && styles.cardPreviewFullBleed]}>
            {isGenerating ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Generating Image...</Text>
              </View>
            ) : (
              <>
                <Image
                  source={{ uri: cardImage || DEFAULT_IMAGE }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                {format === 'fullBleed' && (
                  <>
                    {name ? (
                      <Text style={styles.fullBleedName} numberOfLines={1}>{name}</Text>
                    ) : null}
                    {type ? <Text style={[styles.fullBleedCorner, styles.topLeft]}>{type}</Text> : null}
                    {role ? <Text style={[styles.fullBleedCorner, styles.bottomLeft]}>{role}</Text> : null}
                    {description ? (
                      <Text style={styles.fullBleedDescription} numberOfLines={3}>{description}</Text>
                    ) : null}
                  </>
                )}
              </>
            )}
          </View>

          <View style={styles.imageButtonsContainer}>
            <TouchableOpacity 
              style={[styles.generateButton, (!name || !imageDescription || isGenerating) && styles.generateButtonDisabled]} 
              onPress={generateImage}
              disabled={!name || !imageDescription || isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Wand2 size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.generateButtonText}>Generate</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={uploadImage}
            >
              <Upload size={18} color="#6366f1" style={styles.buttonIcon} />
              <Text style={styles.uploadButtonText}>Upload</Text>
            </TouchableOpacity>
          </View>

          {/* Chat Button - appears after image generation */}
          {cardImage && (
            <TouchableOpacity 
              style={styles.chatButton}
              onPress={initializeChat}
            >
              <Text style={styles.chatButtonText}>💬 Refine with AI Chat</Text>
            </TouchableOpacity>
          )}

          {/* Card Format Toggle */}
          <View style={styles.formatToggleContainer}>
            <Pressable
              style={[styles.formatOption, format === 'framed' && styles.formatOptionSelected]}
              onPress={() => setFormat('framed')}
            >
              <Text style={[styles.formatOptionText, format === 'framed' && styles.formatOptionTextSelected]}>Classic</Text>
            </Pressable>
            <Pressable
              style={[styles.formatOption, format === 'fullBleed' && styles.formatOptionSelected]}
              onPress={() => setFormat('fullBleed')}
            >
              <Text style={[styles.formatOptionText, format === 'fullBleed' && styles.formatOptionTextSelected]}>Full-bleed</Text>
            </Pressable>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
          {errorDetails && <Text style={styles.errorDetailsText}>{errorDetails}</Text>}
          {successMessage && <Text style={styles.successText}>{successMessage}</Text>}

          <TouchableOpacity 
            style={[styles.saveButton, isCreating && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Create Card'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Chat Modal */}
      <Modal
        visible={showChat}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.chatContainer}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>Refine Your Image</Text>
            <TouchableOpacity onPress={closeChat} style={styles.chatCloseButton}>
              <Text style={styles.chatCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.chatMessages} showsVerticalScrollIndicator={false}>
            {chatMessages.map((message) => (
              <View key={message.id} style={[
                styles.chatMessage,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage
              ]}>
                {message.imageUrl && (
                  <Image source={{ uri: message.imageUrl }} style={styles.chatImage} />
                )}
                <Text style={[
                  styles.chatMessageText,
                  message.role === 'user' ? styles.userMessageText : styles.assistantMessageText
                ]}>
                  {message.content}
                </Text>
              </View>
            ))}
            {isChatLoading && (
              <View style={[styles.chatMessage, styles.assistantMessage]}>
                <ActivityIndicator color="#6366f1" size="small" />
                <Text style={styles.assistantMessageText}>Thinking...</Text>
              </View>
            )}
          </ScrollView>
          
          <View style={styles.chatInputContainer}>
            <TextInput
              style={styles.chatInput}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Ask me to adjust colors, style, composition..."
              placeholderTextColor="#666"
              multiline
              maxLength={500}
            />
            <TouchableOpacity 
              style={[styles.chatSendButton, (!chatInput.trim() || isChatLoading) && styles.chatSendButtonDisabled]}
              onPress={sendChatMessage}
              disabled={!chatInput.trim() || isChatLoading}
            >
              <Text style={styles.chatSendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40, // Same width as back button for balance
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  formContainer: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  required: {
    color: '#ff4444',
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
    fontFamily: 'Inter-Regular',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  imageButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  generateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
  },
  descriptionButton: {
    backgroundColor: '#2563eb',
  },
  generateButtonDisabled: {
    backgroundColor: '#4a4a4a',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  uploadButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  buttonIcon: {
    marginRight: 8,
  },
  /* ---- Card Format Toggle ---- */
  formatToggleContainer: {
    flexDirection: 'row',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 8,
    overflow: 'hidden',
  },
  formatOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  formatOptionSelected: {
    backgroundColor: '#6366f1',
  },
  formatOptionText: {
    color: '#6366f1',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  formatOptionTextSelected: {
    color: '#fff',
  },
  /* ---- Full-bleed preview overlay ---- */
  cardPreviewFullBleed: {
    borderWidth: 0,
  },
  fullBleedName: {
    position: 'absolute',
    top: 8,
    right: 8,
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fullBleedCorner: {
    position: 'absolute',
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  topLeft: { top: 8, left: 8 },
  bottomLeft: { bottom: 8, left: 8 },
  fullBleedDescription: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    width: '60%',
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardPreview: {
    height: 250,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  errorText: {
    color: '#ff4444',
    marginTop: 12,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  errorDetailsText: {
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  successText: {
    color: '#22c55e',
    marginTop: 12,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  saveButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#4a4a4a',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  dropdownSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  dropdownText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  placeholderText: {
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    width: '80%',
    maxHeight: '60%',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dropdownItemText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  visibilityOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  visibilityOptionSelected: {
    backgroundColor: '#2a2a2a',
    borderColor: '#6366f1',
  },
  visibilityText: {
    color: '#999',
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  visibilityTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  chatButton: {
    backgroundColor: '#22c55e',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  chatTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  chatCloseButton: {
    padding: 8,
  },
  chatCloseText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  chatMessages: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatMessage: {
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#6366f1',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#222',
    alignSelf: 'flex-start',
  },
  chatMessageText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#fff',
  },
  chatImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#000',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#111',
    color: '#fff',
    padding: 12,
    borderRadius: 20,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  chatSendButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  chatSendButtonDisabled: {
    backgroundColor: '#333',
  },
  chatSendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  /* ---- Gradient Selector ---- */
  gradientOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  gradientOption: {
    width: '48%',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  gradientOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#1a1a2e',
  },
  gradientPreview: {
    width: 60,
    height: 40,
    borderRadius: 8,
    marginBottom: 8,
  },
  gradientName: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  gradientCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
