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
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
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

  const [imageStyle, setImageStyle] = useState('fantasy'); // Ensure this state exists
  
  // Dropdown states
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [showArtStyleDropdown, setShowArtStyleDropdown] = useState(false);
  
  // Dropdown options
  const typeOptions = ['Intention', 'Context', 'Impact', 'Accuracy', 'Agenda', 'Needs', 'Emotion', 'Role'];
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
  const artStyleOptions = [
    { id: 'fantasy', label: 'Fantasy (MTG-inspired)' },
    { id: 'photorealistic', label: 'Photorealistic' },
    { id: 'anime', label: 'Anime' },
    { id: 'digital', label: 'Digital Art' }
  ];

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  // Get auth context at component level
  const { refreshSession } = useAuth();



  // Reset form state when the screen is focused for creating a new card
  useFocusEffect(
    useCallback(() => {
      // We only reset if we are not in edit mode.
      // This ensures that when a user navigates away and back,
      // they get a fresh form instead of the old state.
      if (!isEditing) {
        resetForm();
      }
    }, [isEditing])
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
          // Fetch the card from the database to get the actual visibility settings
          const { data: cardData, error } = await supabase
            .from('cards')
            .select('is_public, is_shared_with_friends')
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
            style: imageStyle,
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
      setImageDescription('');
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
        aspect: [1, 1], // Square aspect ratio for cards
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        // Set loading state
        setIsGenerating(true);
        setError('');
        
        try {
          // Get current session
          const currentSession = await refreshSession();
          
          if (!currentSession || !currentSession.access_token) {
            throw new Error('You must be logged in to upload images');
          }

          // Convert image to blob for upload
          const response = await fetch(imageUri);
          const blob = await response.blob();
          
          // Generate unique filename
          const timestamp = Date.now();
          const fileName = `${currentSession.user.id}/uploaded_${timestamp}.jpg`;
          
          // Upload to Supabase Storage (same bucket as AI-generated images)
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('card_images')
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Failed to upload image: ${uploadError.message}`);
          }

          // Get the public URL
          const { data: { publicUrl } } = supabase.storage
            .from('card_images')
            .getPublicUrl(fileName);

          if (!publicUrl) {
            throw new Error('Failed to get public URL for uploaded image');
          }

          // Set the uploaded image URL
          setCardImage(publicUrl);
          
          // Clear image description since we're using uploaded image
          setImageDescription('');
          
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          
        } catch (uploadErr) {
          console.error('Image upload error:', uploadErr);
          setError(uploadErr instanceof Error ? uploadErr.message : 'Failed to upload image. Please try again.');
        } finally {
          setIsGenerating(false);
        }
      }
    } catch (err) {
      console.error('Image picker error:', err);
      setError('Failed to access image library. Please try again.');
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
    setImageStyle('fantasy');
    
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
    setShowArtStyleDropdown(false);
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
        const { data: newCard, error: insertError } = await supabase
          .from('cards')
          .insert(cardData)
          .select()
          .single();

        if (insertError) throw insertError;
        
        resetForm();
        
        setSuccessMessage('Card created successfully!');
        setTimeout(() => {
          setSuccessMessage('');
          if (returnTo === 'spread' && returnZone) {
            router.replace({
              pathname: '/spread',
              params: { 
                autoAddCard: newCard?.id,
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
            
            <Text style={styles.label}>Art Style</Text>
            <TouchableOpacity 
              style={styles.dropdownSelector}
              onPress={() => setShowArtStyleDropdown(true)}
            >
              <Text style={styles.dropdownText}>
                {artStyleOptions.find(option => option.id === imageStyle)?.label || 'Select art style'}
              </Text>
              <ChevronDown size={20} color="#666" />
            </TouchableOpacity>
            
            <Modal
              visible={showArtStyleDropdown}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowArtStyleDropdown(false)}
            >
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowArtStyleDropdown(false)}
              >
                <View style={styles.dropdownModal}>
                  <FlatList
                    data={artStyleOptions}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setImageStyle(item.id);
                          setShowArtStyleDropdown(false);
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{item.label}</Text>
                        {imageStyle === item.id && <Check size={20} color="#6366f1" />}
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
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
});
