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
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import debounce from 'lodash/debounce';
import { Wand2, ChevronDown, ChevronUp, Lock, Users, Globe2 } from 'lucide-react-native';

SplashScreen.preventAutoHideAsync();

// Supabase client is already imported from @/lib/supabase

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop';
const DEFAULT_FRAME_COLOR = '#808080'; // Medium gray

export default function CreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditing = !!params.id;

  // Initialize state with params or defaults
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [type, setType] = useState('');
  const [role, setRole] = useState('');
  const [context, setContext] = useState('');
  const [cardImage, setCardImage] = useState('');
  
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
      
      // Handle color parameters
      if (params.frame_color) {
        // Frame color is now fixed to blue in your app, but handle it anyway
      }
      if (params.name_color) {
        // Handle name color if needed
      }
      if (params.type_color) {
        // Handle type color if needed
      }
      if (params.description_color) {
        // Handle description color if needed
      }
      if (params.context_color) {
        // Handle context color if needed
      }
      
      // Log the loaded data for debugging
      console.log('Card data loaded successfully for editing');
    }
  }, [params.id, params.name, params.description, params.type, params.role, params.context, params.image_url]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [authChecking, setAuthChecking] = useState(false);
  
  // Collapsible section states
  const [visibility, setVisibility] = useState<string[]>(['personal']);
  const [showVisibility, setShowVisibility] = useState(false);

  const [imageStyle, setImageStyle] = useState('fantasy'); // Ensure this state exists

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  // Get auth context at component level
  const { refreshSession } = useAuth();

  // Check auth status on component mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setAuthChecking(true);
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          // console.log('No active session found on component mount');
          // You could show a message or redirect here if needed
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
    
    // console.log('Generating image with style:', imageStyle);

    setIsGenerating(true);
    setError('');
    setErrorDetails('');

    try {
      setAuthChecking(true);
      
      // First, try to refresh the session to ensure we have the latest token
      const currentSession = await refreshSession();
      
      if (!currentSession || !currentSession.access_token) {
        console.error('No valid session found after refresh attempt');
        throw new Error('You must be logged in to generate images');
      }
      
      // console.log('Session verified, proceeding with image generation with token:', 
      //   currentSession.access_token.substring(0, 10) + '...');

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
            style: imageStyle, // Use the state variable here
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

      // console.log('Successfully received image URL');
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

  // Function to reset form to initial state
  const resetForm = () => {
    setName('');
    setDescription('');
    setImageDescription('');
    setType('');
    setRole('');
    setContext('');
    setCardImage('');
    setVisibility(['personal']);
    setError('');
    setErrorDetails('');
    setSuccessMessage('');
    
    // Reset UI states
    // console.log('Form has been reset for new card creation');
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
      // Use the refreshSession from auth context to ensure we have the latest session
      const currentSession = await refreshSession();
      
      if (!currentSession) {
        throw new Error('You must be logged in to create cards');
      }

      // First, create or get a collection for this user
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
        // Create a new collection
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

      const cardData = {
        name,
        description: description || '',
        type: type || 'Card',
        role: role || 'General',
        context: context || 'Fantasy',
        image_url: cardImage,
        frame_color: DEFAULT_FRAME_COLOR,
        user_id: currentSession.user.id,
        collection_id: collectionId
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('cards')
          .update(cardData)
          .eq('id', params.id)
          .eq('user_id', currentSession.user.id);

        if (updateError) throw updateError;
        
        console.log(`Card updated with frame color: ${DEFAULT_FRAME_COLOR}`);
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
        
        console.log(`New card created with frame color: ${DEFAULT_FRAME_COLOR}, ID: ${newCard?.id}`);
        
        // Reset the form for new card creation
        resetForm();
        
        // Show success message briefly before redirecting
        setSuccessMessage('Card created successfully!');
        setTimeout(() => {
          setSuccessMessage('');
          router.replace('/');
        }, 2000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Card operation error:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>
        {isEditing ? 'Edit Card' : 'Create New Card'}
      </Text>

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
        
        <Text style={styles.label}>Art Style</Text>
        <View style={styles.styleDropdownContainer}>
          <TouchableOpacity 
            style={[styles.styleOption, imageStyle === 'fantasy' && styles.styleOptionSelected]}
            onPress={() => setImageStyle('fantasy')}
          >
            <Text style={[styles.styleText, imageStyle === 'fantasy' && styles.styleTextSelected]}>Fantasy (MTG-inspired)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.styleOption, imageStyle === 'photorealistic' && styles.styleOptionSelected]}
            onPress={() => setImageStyle('photorealistic')}
          >
            <Text style={[styles.styleText, imageStyle === 'photorealistic' && styles.styleTextSelected]}>Photorealistic</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.styleOption, imageStyle === 'anime' && styles.styleOptionSelected]}
            onPress={() => setImageStyle('anime')}
          >
            <Text style={[styles.styleText, imageStyle === 'anime' && styles.styleTextSelected]}>Anime</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.styleOption, imageStyle === 'digital' && styles.styleOptionSelected]}
            onPress={() => setImageStyle('digital')}
          >
            <Text style={[styles.styleText, imageStyle === 'digital' && styles.styleTextSelected]}>Digital Art</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Card Type</Text>
        <TextInput
          style={styles.input}
          value={type}
          onChangeText={setType}
          placeholder="e.g., Creature (optional)"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Card Role</Text>
        <TextInput
          style={styles.input}
          value={role}
          onChangeText={setRole}
          placeholder="e.g., Attacker (optional)"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Context</Text>
        <TextInput
          style={styles.input}
          value={context}
          onChangeText={setContext}
          placeholder="e.g., Fantasy (optional)"
          placeholderTextColor="#666"
        />
      </View>

      {/* Visibility Settings - Replaced dropdown with static section */}
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

      {successMessage ? (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          {errorDetails ? (
            <Text style={styles.errorDetails}>{errorDetails}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.imageSection}>
        <TouchableOpacity
          style={[styles.generateButton, (isGenerating || authChecking || !name || !imageDescription) && styles.generateButtonDisabled]}
          onPress={generateImage}
          disabled={isGenerating || authChecking || !name || !imageDescription}
        >
          {isGenerating || authChecking ? (
            <ActivityIndicator color="#fff" size="small" style={styles.buttonIcon} />
          ) : (
            <Wand2 color="#fff" size={20} style={styles.buttonIcon} />
          )}
          <Text style={styles.generateButtonText}>
            {isGenerating ? 'Generating...' : authChecking ? 'Checking auth...' : 'Generate Image'}
          </Text>
        </TouchableOpacity>

        {cardImage ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: cardImage }}
              style={styles.cardImage}
              resizeMode="contain"
            />
          </View>
        ) : null}
      </View>

      <TouchableOpacity 
        style={[
          styles.createButton,
          (isCreating || !name || !cardImage) && 
          styles.createButtonDisabled
        ]} 
        onPress={handleSave}
        disabled={isCreating || !name || !cardImage}
      >
        {isCreating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>
            {isEditing ? 'Save Changes' : 'Create Card'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    padding: 16,
  },
  screenTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  required: {
    color: '#ff4444',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  visibilityOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  visibilityOptionSelected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  visibilityText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  visibilityTextSelected: {
    color: '#fff',
    fontFamily: 'Inter-Bold',
  },
  styleDropdownContainer: {
    marginBottom: 16,
    flexDirection: 'column',
    gap: 8,
  },
  styleOption: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  styleOptionSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  styleText: {
    color: '#aaa',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  styleTextSelected: {
    color: '#fff',
    fontFamily: 'Inter-Bold',
  },
  errorContainer: {
    backgroundColor: '#2a0000',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#ff4444',
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    marginBottom: 8,
  },
  successContainer: {
    backgroundColor: '#e6f7e6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    color: '#2e7d32',
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    textAlign: 'center',
  },
  errorDetails: {
    color: '#ff8888',
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  imageSection: {
    marginBottom: 20,
  },
  generateButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  generateButtonDisabled: {
    backgroundColor: '#4338ca',
    opacity: 0.5,
  },
  buttonIcon: {
    marginRight: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  imageContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    overflow: 'hidden',
    aspectRatio: 1,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#004999',
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
});