import { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { Wand as Wand2, ChevronDown, ChevronUp, Lock, Users, Globe as Globe2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';

SplashScreen.preventAutoHideAsync();

// Supabase client is already imported from @/lib/supabase

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop';
const DEFAULT_FRAME_COLOR = '#FFD700';
const DEFAULT_FRAME_WIDTH = 8;
const DEFAULT_NAME_COLOR = '#FFFFFF';
const DEFAULT_TYPE_COLOR = '#FFFFFF';
const DEFAULT_DESCRIPTION_COLOR = '#FFFFFF';
const DEFAULT_CONTEXT_COLOR = '#CCCCCC';

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
  const [frameWidth, setFrameWidth] = useState(params.frame_width ? parseInt(params.frame_width.toString()) : DEFAULT_FRAME_WIDTH);
  const [frameColor, setFrameColor] = useState(params.frame_color?.toString() || DEFAULT_FRAME_COLOR);
  const [nameColor, setNameColor] = useState(params.name_color?.toString() || DEFAULT_NAME_COLOR);
  const [typeColor, setTypeColor] = useState(params.type_color?.toString() || DEFAULT_TYPE_COLOR);
  const [descriptionColor, setDescriptionColor] = useState(params.description_color?.toString() || DEFAULT_DESCRIPTION_COLOR);
  const [contextColor, setContextColor] = useState(params.context_color?.toString() || DEFAULT_CONTEXT_COLOR);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [authChecking, setAuthChecking] = useState(false);
  
  // Collapsible section states
  const [showCustomization, setShowCustomization] = useState(false);
  const [showFrameOptions, setShowFrameOptions] = useState(false);
  const [showTextColors, setShowTextColors] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);
  const [visibility, setVisibility] = useState<string[]>(['personal']);

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
          console.log('No active session found on component mount');
          // You could show a message or redirect here if needed
        } else {
          console.log('Active session found on component mount');
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
      
      console.log('Session verified, proceeding with image generation with token:', 
        currentSession.access_token.substring(0, 10) + '...');

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

      console.log('Successfully received image URL');
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
    setFrameWidth(DEFAULT_FRAME_WIDTH);
    setFrameColor(DEFAULT_FRAME_COLOR);
    setNameColor(DEFAULT_NAME_COLOR);
    setTypeColor(DEFAULT_TYPE_COLOR);
    setDescriptionColor(DEFAULT_DESCRIPTION_COLOR);
    setContextColor(DEFAULT_CONTEXT_COLOR);
    setVisibility(['personal']);
    setError('');
    setErrorDetails('');
    setSuccessMessage('');
    
    // Reset UI states
    setShowCustomization(false);
    setShowFrameOptions(false);
    setShowTextColors(false);
    setShowVisibility(false);
    
    console.log('Form has been reset for new card creation');
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
        frame_width: frameWidth,
        frame_color: frameColor,
        name_color: nameColor,
        type_color: typeColor,
        description_color: descriptionColor,
        context_color: contextColor,
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
        
        console.log('Card successfully updated');
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
        
        console.log('Card successfully created with ID:', newCard?.id);
        
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

  interface ColorPickerProps {
    label: string;
    value: string;
    onChange: (color: string) => void;
  }

  const ColorPicker = ({ label, value, onChange }: ColorPickerProps) => (
    <View style={styles.colorPickerContainer}>
      <Text style={styles.colorPickerLabel}>{label}</Text>
      <View style={styles.colorGrid}>
        {[
          '#FFFFFF', // White
          '#CCCCCC', // Light Gray
          '#FFD700', // Gold
          '#FFA500', // Orange
          '#FF4444', // Red
          '#4CAF50', // Green
          '#2196F3', // Blue
          '#9C27B0', // Purple
          '#000000', // Black
        ].map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              value === color && styles.colorOptionSelected,
            ]}
            onPress={() => onChange(color)}
          />
        ))}
      </View>
    </View>
  );

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
        <Text style={styles.label}>Card Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Enter card description (optional)"
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
          value={imageDescription}
          onChangeText={setImageDescription}
          placeholder="Describe how you want the card image to look"
          placeholderTextColor="#666"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
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
        title="Card Customization"
        isOpen={showCustomization}
        onToggle={() => setShowCustomization(!showCustomization)}
      >
        <CollapsibleSection
          title="Frame Options"
          isOpen={showFrameOptions}
          onToggle={() => setShowFrameOptions(!showFrameOptions)}
        >
          <View style={styles.frameWidthContainer}>
            <Text style={styles.label}>Frame Width</Text>
            <View style={styles.frameWidthControls}>
              <TouchableOpacity
                style={styles.frameWidthButton}
                onPress={() => setFrameWidth(Math.max(4, frameWidth - 2))}
              >
                <Text style={styles.frameWidthButtonText}>-</Text>
              </TouchableOpacity>
              <View style={styles.frameWidthPreview}>
                <Text style={styles.frameWidthText}>{frameWidth}px</Text>
              </View>
              <TouchableOpacity
                style={styles.frameWidthButton}
                onPress={() => setFrameWidth(Math.min(16, frameWidth + 2))}
              >
                <Text style={styles.frameWidthButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.frameColorContainer}>
            <Text style={styles.label}>Frame Color</Text>
            <View style={styles.colorGrid}>
              {[
                '#FFD700', // Gold
                '#C0C0C0', // Silver
                '#CD7F32', // Bronze
                '#FF4444', // Red
                '#4CAF50', // Green
                '#2196F3', // Blue
                '#9C27B0', // Purple
                '#FFFFFF', // White
                '#000000', // Black
              ].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    frameColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setFrameColor(color)}
                />
              ))}
            </View>
          </View>
        </CollapsibleSection>

        <CollapsibleSection
          title="Text Colors"
          isOpen={showTextColors}
          onToggle={() => setShowTextColors(!showTextColors)}
        >
          <ColorPicker
            label="Card Name"
            value={nameColor}
            onChange={setNameColor}
          />
          <ColorPicker
            label="Type Text"
            value={typeColor}
            onChange={setTypeColor}
          />
          <ColorPicker
            label="Description"
            value={descriptionColor}
            onChange={setDescriptionColor}
          />
          <ColorPicker
            label="Context Text"
            value={contextColor}
            onChange={setContextColor}
          />
        </CollapsibleSection>

        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Preview</Text>
          <View style={[
            styles.previewCard,
            {
              borderWidth: frameWidth,
              borderColor: frameColor,
            }
          ]}>
            <Text style={[styles.previewText, { color: nameColor }]}>Card Name</Text>
            <Text style={[styles.previewText, { color: typeColor }]}>Card Type</Text>
            <Text style={[styles.previewText, { color: descriptionColor }]}>Description</Text>
            <Text style={[styles.previewText, { color: contextColor }]}>Context</Text>
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
    gap: 12,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  colorOptionSelected: {
    borderColor: '#fff',
    borderWidth: 3,
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
});