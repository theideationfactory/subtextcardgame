import { useState } from 'react';
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
  Animated,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { Wand as Wand2, ChevronDown, ChevronUp, Lock, Users, Globe as Globe2 } from 'lucide-react-native';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useLocalSearchParams } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

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

  const [name, setName] = useState(params.name?.toString() || '');
  const [description, setDescription] = useState(params.description?.toString() || '');
  const [imageDescription, setImageDescription] = useState('');
  const [type, setType] = useState(params.type?.toString() || '');
  const [role, setRole] = useState(params.role?.toString() || '');
  const [context, setContext] = useState(params.context?.toString() || '');
  const [cardImage, setCardImage] = useState(params.image_url?.toString() || '');
  const [frameWidth, setFrameWidth] = useState(
    params.frame_width ? parseInt(params.frame_width.toString()) : DEFAULT_FRAME_WIDTH
  );
  const [frameColor, setFrameColor] = useState(params.frame_color?.toString() || DEFAULT_FRAME_COLOR);
  const [nameColor, setNameColor] = useState(params.name_color?.toString() || DEFAULT_NAME_COLOR);
  const [typeColor, setTypeColor] = useState(params.type_color?.toString() || DEFAULT_TYPE_COLOR);
  const [descriptionColor, setDescriptionColor] = useState(params.description_color?.toString() || DEFAULT_DESCRIPTION_COLOR);
  const [contextColor, setContextColor] = useState(params.context_color?.toString() || DEFAULT_CONTEXT_COLOR);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  
  // Collapsible section states
  const [showCustomization, setShowCustomization] = useState(false);
  const [showFrameOptions, setShowFrameOptions] = useState(false);
  const [showTextColors, setShowTextColors] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);
  const [visibility, setVisibility] = useState<string[]>(
    params.visibility ? JSON.parse(params.visibility.toString()) : ['personal']
  );

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const generateImage = async () => {
    if (!name || !imageDescription) {
      setError('Please provide a name and image description');
      return;
    }

    setIsGenerating(true);
    setError('');
    setErrorDetails('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('You must be logged in to generate images');
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-card-image`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description: imageDescription,
            userId: session.user.id
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to generate image');
        setErrorDetails(data.details || '');
        throw new Error(data.error || 'Failed to generate image');
      }

      if (!data.imageUrl) {
        throw new Error('No image URL received');
      }

      setCardImage(data.imageUrl);
      setImageDescription('');
    } catch (err) {
      console.error('Image generation error:', err);
    } finally {
      setIsGenerating(false);
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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('You must be logged in to create cards');
      }

      // First, create or get a collection for this user
      const { data: existingCollections, error: collectionError } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', session.user.id)
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
            user_id: session.user.id,
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
        user_id: session.user.id,
        collection_id: collectionId
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('cards')
          .update(cardData)
          .eq('id', params.id)
          .eq('user_id', session.user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('cards')
          .insert(cardData);

        if (insertError) throw insertError;
      }

      router.replace('/');
    } catch (err) {
      setError(err.message);
      console.error('Card operation error:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const ColorPicker = ({ label, value, onChange }) => (
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

  const CollapsibleSection = ({ title, isOpen, onToggle, children }) => (
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

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          {errorDetails ? (
            <Text style={styles.errorDetails}>{errorDetails}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.imageSection}>
        <TouchableOpacity
          style={[
            styles.generateButton,
            (isGenerating || !name || !imageDescription) && 
            styles.generateButtonDisabled
          ]}
          onPress={generateImage}
          disabled={isGenerating || !name || !imageDescription}
        >
          {isGenerating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Wand2 size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.generateButtonText}>Generate New Image</Text>
            </>
          )}
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