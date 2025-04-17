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
import { Wand as Wand2, ChevronDown, ChevronUp, Lock, Users, Globe as Globe2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import debounce from 'lodash/debounce';

SplashScreen.preventAutoHideAsync();

// Supabase client is already imported from @/lib/supabase

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop';
const DEFAULT_FRAME_COLOR = '#FFD700';

export default function CreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditing = !!params.id;

  // Initialize state with params or defaults
  const [name, setName] = useState(params.name?.toString() || '');
  const [description, setDescription] = useState(params.description?.toString() || '');
  const [imageDescription, setImageDescription] = useState('');
  const [type, setType] = useState(params.type?.toString() || '');
  const [role, setRole] = useState(params.role?.toString() || '');
  const [context, setContext] = useState(params.context?.toString() || '');
  const [cardImage, setCardImage] = useState(params.image_url?.toString() || '');
  // Initialize with default, will be updated in useEffect if editing
  const [frameColor, setFrameColor] = useState(DEFAULT_FRAME_COLOR);
  const [imageStyle, setImageStyle] = useState('fantasy'); // Default style is fantasy (MTG-inspired)
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [authChecking, setAuthChecking] = useState(false);
  
  // Collapsible section states
  const [showFrameColor, setShowFrameColor] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);
  const [visibility, setVisibility] = useState<string[]>(['personal']);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  // Get auth context at component level
  const { refreshSession } = useAuth();

  // Define color options as a constant to avoid recreating on each render
  const COLOR_OPTIONS = [
    { color: '#FFD700', name: 'Gold' },
    { color: '#C0C0C0', name: 'Silver' },
    { color: '#CD7F32', name: 'Bronze' },
    { color: '#FF4444', name: 'Red' },
    { color: '#4CAF50', name: 'Green' },
    { color: '#2196F3', name: 'Blue' },
    { color: '#9C27B0', name: 'Purple' },
    { color: '#FFFFFF', name: 'White' },
    { color: '#000000', name: 'Black' },
  ];
  
  // Helper function to get color name from hex value with improved validation
  const getColorName = (hexColor: string): string => {
    if (!hexColor) return 'Default Gold';
    
    // Normalize the input color for reliable comparison
    const normalizedColor = hexColor.trim().toLowerCase();
    
    const colorOption = COLOR_OPTIONS.find(option => 
      option.color.toLowerCase() === normalizedColor);
    
    if (colorOption) {
      return colorOption.name;
    }
    
    // If we couldn't find a matching name, return the hex code but make sure it's formatted
    return hexColor.startsWith('#') ? hexColor : `#${hexColor}`;
  };

  // Use debounce to prevent multiple rapid selections
  const handleSelectColor = useCallback((color: string) => {
    // Always set the color directly
    setFrameColor(color);
    
    // Provide stronger haptic feedback for better tactile response
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      // console.log('Haptic feedback not available');
    }
    
    // Always log color selection to help with debugging
    console.log(`DEBUG_COLOR: User selected frame color: ${color}`);
  }, []);

  // Initialize frame color from params for edited cards
  useEffect(() => {
    if (isEditing) {
      // Force frame color section to be visible when editing
      setShowFrameColor(true);
      
      if (params.frame_color) {
        // Extract the frame color from params and clean it
        const editingColor = params.frame_color.toString().trim();
        console.log(`DEBUG_COLOR: Initializing edited card with frame color: ${editingColor}`);
        
        // Validate it's a proper color before setting
        if (editingColor.startsWith('#') || COLOR_OPTIONS.some(opt => 
            opt.color.toLowerCase() === editingColor.toLowerCase())) {
          setFrameColor(editingColor);
          console.log(`DEBUG_COLOR: Valid color format - set successfully to ${editingColor}`);
        } else {
          console.log(`DEBUG_COLOR: Invalid color format: ${editingColor}, using default ${DEFAULT_FRAME_COLOR}`);
          setFrameColor(DEFAULT_FRAME_COLOR);
        }
      } else {
        console.log(`DEBUG_COLOR: No frame color in params, using default ${DEFAULT_FRAME_COLOR}`);
        setFrameColor(DEFAULT_FRAME_COLOR);
      }
    }
  }, [isEditing, params.frame_color]);

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

  // Remove redundant useEffect for loading card data when editing, as state is now initialized from params above.

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
    setFrameColor(DEFAULT_FRAME_COLOR);
    setVisibility(['personal']);
    setError('');
    setErrorDetails('');
    setSuccessMessage('');
    
    // Reset UI states
    setShowFrameColor(false);
    setShowVisibility(false);
    
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
        frame_color: frameColor,
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
        
        console.log(`DEBUG_COLOR: Card updated with frame color: ${frameColor}`);
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
        
        console.log(`DEBUG_COLOR: New card created with frame color: ${frameColor}, ID: ${newCard?.id}`);
        
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

  interface CollapsibleSectionProps {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
  }

  const CollapsibleSection = ({ title, isOpen, onToggle, children }: CollapsibleSectionProps) => (
    <View style={styles.collapsibleSection}>
      <TouchableOpacity 
        style={styles.collapsibleHeader} 
        onPress={onToggle}
      >
        <Text style={styles.collapsibleTitle}>{title}</Text>
        {isOpen ? (
          <ChevronUp size={24} color="#fff" />
        ) : (
          <ChevronDown size={24} color="#fff" />
        )}
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.collapsibleContent}>
          {children}
        </View>
      )}
    </View>
  );

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

      <CollapsibleSection
        title={`Frame Color (${getColorName(frameColor)})`}
        isOpen={showFrameColor}
        onToggle={() => setShowFrameColor(!showFrameColor)}
      >
        <View style={styles.frameColorContainer}>
          <Text style={styles.colorSelectedText}>Selected: {getColorName(frameColor)}</Text>
          <View style={styles.colorGrid}>
            {COLOR_OPTIONS.map(({ color, name }) => {
              // Compare colors in a case-insensitive way to ensure reliable matching
              const isSelected = frameColor.toLowerCase() === color.toLowerCase();
              // No logging during rendering to prevent excessive logs
              return (
                <TouchableOpacity
                  key={color}
                  accessible={true}
                  accessibilityLabel={`${name} color`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.colorOptionTouchable, // New wrapper style with larger touch area
                  ]}
                  onPress={() => handleSelectColor(color)}
                  activeOpacity={0.4}
                  hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }} // Even larger hit slop
                  delayPressIn={50}
                >
                  {/* Actual visible color circle inside the larger touch target */}
                  <View style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    isSelected && styles.colorOptionSelected,
                  ]}>
                    {isSelected && (
                      <View style={styles.colorSelectedIndicator} />
                    )}
                  </View>
                  {isSelected && (
                    <Text style={styles.colorName}>{name}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        title="Visibility Settings"
        isOpen={showVisibility}
        onToggle={() => setShowVisibility(!showVisibility)}
      >
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
      </CollapsibleSection>

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
  collapsibleSection: {
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2a2a2a',
  },
  collapsibleTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#fff',
  },
  collapsibleContent: {
    padding: 16,
  },
  frameWidthContainer: {
    marginBottom: 16,
  },
  frameWidthControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 8,
  },
  frameWidthButton: {
    backgroundColor: '#3a3a3a',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameWidthButtonText: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Inter-Bold',
  },
  frameWidthPreview: {
    flex: 1,
    alignItems: 'center',
  },
  frameWidthText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter-Regular',
  },
  frameColorContainer: {
    marginBottom: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10, // Reduced visible gap since the touchable area is larger
    padding: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    justifyContent: 'center',
    marginBottom: 16,
  },
  colorOptionTouchable: {
    width: 100, // Larger touchable area (invisible)
    height: 100, // Larger touchable area (invisible)
    alignItems: 'center',
    justifyContent: 'center',
    margin: 5,
    position: 'relative',
  },
  colorOption: {
    width: 70, // Original visual size
    height: 70, // Original visual size
    borderRadius: 35,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  colorOptionSelected: {
    borderColor: '#ffffff',
    borderWidth: 5,
    transform: [{ scale: 1.15 }],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  colorSelectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  colorSelectedText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
    paddingVertical: 8,
  },
  colorName: {
    position: 'absolute',
    bottom: -18,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  colorPickerContainer: {
    marginBottom: 16,
  },
  colorPickerLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  previewSection: {
    marginTop: 16,
  },
  previewTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
  },
  previewCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  previewText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
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
});