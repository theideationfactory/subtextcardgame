import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal, Alert, Platform, Dimensions, Image } from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Trash2, Check, Upload, X, Wand2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { log, logError } from '@/utils/logger';

const PHENOMENA_STORAGE_KEY = '@phenomena_types';
const DEFAULT_PHENOMENA = ['Intention', 'Context', 'Impact', 'Accuracy', 'Agenda', 'Needs', 'Emotion', 'Role'];

const { width: screenWidth } = Dimensions.get('window');
const CARD_MARGIN = 8;
const CARDS_PER_ROW = 2;
const CARD_WIDTH = (screenWidth - 40 - (CARD_MARGIN * (CARDS_PER_ROW + 1))) / CARDS_PER_ROW;
const CARD_HEIGHT = CARD_WIDTH * 1.4; // Portrait aspect ratio

// Gradient colors for different phenomena types
const PHENOMENA_GRADIENTS: Record<string, [string, string]> = {
  'Intention': ['#6366f1', '#8b5cf6'],
  'Context': ['#0ea5e9', '#06b6d4'],
  'Impact': ['#f59e0b', '#ef4444'],
  'Accuracy': ['#10b981', '#059669'],
  'Agenda': ['#ec4899', '#be185d'],
  'Needs': ['#8b5cf6', '#6366f1'],
  'Emotion': ['#ef4444', '#dc2626'],
  'Role': ['#06b6d4', '#0891b2'],
  // Default gradient for custom phenomena
  'default': ['#374151', '#1f2937'],
};

export default function DeckCreationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  const [phenomenaTypes, setPhenomenaTypes] = useState<string[]>(DEFAULT_PHENOMENA);
  const [newPhenomena, setNewPhenomena] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Image upload modal state
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedPhenomena, setSelectedPhenomena] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  
  // Custom deck images state
  const [customDeckImages, setCustomDeckImages] = useState<Record<string, string>>({});

  // Load saved phenomena types and custom deck images on component mount
  useEffect(() => {
    loadPhenomenaTypes();
    loadCustomDeckImages();
  }, []);

  const loadPhenomenaTypes = async () => {
    try {
      if (!user) {
        setIsLoading(false);
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
        setPhenomenaTypes(userData.custom_phenomena_types);
      } else {
        // If no database data, try to migrate from AsyncStorage
        await migrateFromAsyncStorage();
      }
    } catch (error) {
      logError('Error loading phenomena types:', error);
      // Fall back to AsyncStorage
      await loadFromAsyncStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromAsyncStorage = async () => {
    try {
      const saved = await AsyncStorage.getItem(PHENOMENA_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPhenomenaTypes(parsed);
      }
    } catch (error) {
      logError('Error loading from AsyncStorage:', error);
    }
  };

  const migrateFromAsyncStorage = async () => {
    try {
      const saved = await AsyncStorage.getItem(PHENOMENA_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPhenomenaTypes(parsed);
        // Save to database
        await savePhenomenaTypes(parsed);
        // Clear AsyncStorage after successful migration
        await AsyncStorage.removeItem(PHENOMENA_STORAGE_KEY);
      }
    } catch (error) {
      logError('Error migrating from AsyncStorage:', error);
    }
  };

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
        await AsyncStorage.setItem(PHENOMENA_STORAGE_KEY, JSON.stringify(types));
      }
    } catch (error) {
      logError('Error saving phenomena types:', error);
      // Fall back to AsyncStorage
      try {
        await AsyncStorage.setItem(PHENOMENA_STORAGE_KEY, JSON.stringify(types));
      } catch (storageError) {
        logError('Error saving to AsyncStorage:', storageError);
      }
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

  const addPhenomena = async () => {
    if (!newPhenomena.trim()) {
      Alert.alert('Error', 'Please enter a phenomena name');
      return;
    }

    const trimmedName = newPhenomena.trim();
    
    if (phenomenaTypes.includes(trimmedName)) {
      Alert.alert('Error', 'This phenomena type already exists');
      return;
    }

    const updatedTypes = [...phenomenaTypes, trimmedName];
    setPhenomenaTypes(updatedTypes);
    await savePhenomenaTypes(updatedTypes);
    setNewPhenomena('');
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const removePhenomena = async (phenomena: string) => {
    // Prevent removal of default phenomena types
    if (DEFAULT_PHENOMENA.includes(phenomena)) {
      Alert.alert('Cannot Remove', 'Default phenomena types cannot be removed');
      return;
    }

    Alert.alert(
      'Remove Phenomena',
      `Are you sure you want to remove "${phenomena}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updatedTypes = phenomenaTypes.filter(type => type !== phenomena);
            setPhenomenaTypes(updatedTypes);
            await savePhenomenaTypes(updatedTypes);
            
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          }
        }
      ]
    );
  };

  const resetToDefaults = async () => {
    Alert.alert(
      'Reset to Defaults',
      'This will remove all custom phenomena types and restore the original 8 types. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setPhenomenaTypes(DEFAULT_PHENOMENA);
            await savePhenomenaTypes(DEFAULT_PHENOMENA);
            
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          }
        }
      ]
    );
  };

  // Handle long press to open image upload modal
  const handleLongPress = (phenomenaType: string) => {
    log('[DeckCreation] Long press detected for', phenomenaType);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    setSelectedPhenomena(phenomenaType);
    setShowImageModal(true);
  };

  // Handle image upload
  const handleImageUpload = async () => {
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

      if (!result.canceled && result.assets[0] && selectedPhenomena) {
        const imageUri = result.assets[0].uri;
        
        // Update custom deck images
        const updatedImages = {
          ...customDeckImages,
          [selectedPhenomena]: imageUri
        };
        
        setCustomDeckImages(updatedImages);
        await saveCustomDeckImages(updatedImages);
        
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        
        setShowImageModal(false);
        setSelectedPhenomena(null);
      }
    } catch (error) {
      logError('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Remove custom deck image
  const handleRemoveImage = async () => {
    if (!selectedPhenomena) return;
    
    const updatedImages = { ...customDeckImages };
    delete updatedImages[selectedPhenomena];
    
    setCustomDeckImages(updatedImages);
    await saveCustomDeckImages(updatedImages);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    setShowImageModal(false);
    setSelectedPhenomena(null);
  };

  // Generate deck image with AI via Supabase Edge Function
  const handleGenerateImage = async () => {
    if (!selectedPhenomena) return;
    if (!imagePrompt.trim()) {
      Alert.alert('Add a description', 'Please describe the image you want for this deck.');
      return;
    }
    try {
      setGeneratingImage(true);
      // Invoke the same edge function used in card creation
      const { data, error } = await supabase.functions.invoke('generate-card-image', {
        body: {
          name: `${selectedPhenomena} Deck`,
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
        [selectedPhenomena]: data.imageUrl as string,
      };
      setCustomDeckImages(updatedImages);
      await saveCustomDeckImages(updatedImages);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Close modal and reset prompt
      setShowImageModal(false);
      setSelectedPhenomena(null);
      setImagePrompt('');
    } catch (err) {
      logError('AI generation failed:', err);
      Alert.alert('Generation failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handlePhenomenaPress = (phenomenaType: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Navigate to deck detail screen
    router.push({
      pathname: '/deck-detail',
      params: {
        type: phenomenaType
      }
    });
  };

  if (!fontsLoaded || isLoading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Create a Deck</Text>
      </View>
      
      {/* Add New Phenomena - Frozen at top */}
      <View style={styles.frozenAddSection}>
        <TextInput
          style={styles.addInput}
          placeholder="Enter phenomena name..."
          placeholderTextColor="#666"
          value={newPhenomena}
          onChangeText={setNewPhenomena}
          onSubmitEditing={addPhenomena}
          returnKeyType="done"
        />
        <TouchableOpacity 
          style={styles.addButton}
          onPress={addPhenomena}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={phenomenaTypes}
        keyExtractor={(item) => item}
        numColumns={CARDS_PER_ROW}
        columnWrapperStyle={styles.cardRow}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const isDefault = DEFAULT_PHENOMENA.includes(item);
          const gradientColors = PHENOMENA_GRADIENTS[item] || PHENOMENA_GRADIENTS.default;
          const customImage = customDeckImages[item];
          
          return (
            <TouchableOpacity 
              style={styles.cardContainer}
              onPress={() => handlePhenomenaPress(item)}
              onLongPress={() => handleLongPress(item)}
              delayLongPress={300}
              pressRetentionOffset={{ top: 20, left: 20, bottom: 20, right: 20 }}
              activeOpacity={0.8}
            >
              {customImage ? (
                <View style={styles.phenomenaCard}>
                  <Image
                    source={{ uri: customImage }}
                    style={styles.deckImage}
                    resizeMode="cover"
                  />
                  <View style={styles.imageOverlay}>
                    {/* Card deck effect with multiple layers */}
                    <View style={[styles.cardLayer, styles.cardLayer3]} />
                    <View style={[styles.cardLayer, styles.cardLayer2]} />
                    
                    {/* Main card content */}
                    <View style={styles.cardContent}>
                      <View style={styles.cardHeader}>
                        {isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                        {!isDefault && (
                          <TouchableOpacity 
                            style={styles.removeButtonCard}
                            onPress={() => removePhenomena(item)}
                          >
                            <Trash2 size={16} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </View>
                      
                      <View style={styles.cardTitle}>
                        <Text style={[styles.phenomenaCardName, styles.imageCardName]}>{item}</Text>
                        <Text style={[styles.deckLabel, styles.imageDeckLabel]}>DECK</Text>
                      </View>
                      
                      {/* Card count indicator */}
                      <View style={styles.cardFooter}>
                        <View style={styles.cardCountIndicator}>
                          <View style={styles.cardCountDot} />
                          <View style={styles.cardCountDot} />
                          <View style={styles.cardCountDot} />
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
                <LinearGradient
                  colors={gradientColors}
                  style={styles.phenomenaCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {/* Card deck effect with multiple layers */}
                  <View style={[styles.cardLayer, styles.cardLayer3]} />
                  <View style={[styles.cardLayer, styles.cardLayer2]} />
                  
                  {/* Main card content */}
                  <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    {isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                    {!isDefault && (
                      <TouchableOpacity 
                        style={styles.removeButtonCard}
                        onPress={() => removePhenomena(item)}
                      >
                        <Trash2 size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <View style={styles.cardTitle}>
                    <Text style={styles.phenomenaCardName}>{item}</Text>
                    <Text style={styles.deckLabel}>DECK</Text>
                  </View>
                  
                  {/* Card count indicator */}
                  <View style={styles.cardFooter}>
                    <View style={styles.cardCountIndicator}>
                      <View style={styles.cardCountDot} />
                      <View style={styles.cardCountDot} />
                      <View style={styles.cardCountDot} />
                    </View>
                    </View>
                  </View>
                </LinearGradient>
              )}
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <View style={styles.customizationSection}>
            {/* List Header */}
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Current Phenomena Decks ({phenomenaTypes.length})</Text>
              <TouchableOpacity 
                style={styles.resetButton}
                onPress={resetToDefaults}
              >
                <Text style={styles.resetButtonText}>Reset to Defaults</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
      />
      
      {/* Image Upload Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customize {selectedPhenomena} Deck</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowImageModal(false)}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              Upload an image to use as the background for your {selectedPhenomena} deck cards.
            </Text>

            {/* AI Image Prompt */}
            <View style={styles.promptGroup}>
              <Text style={styles.promptLabel}>Describe the image</Text>
              <TextInput
                style={styles.promptInput}
                placeholder="e.g. Abstract cosmic pattern in deep blues and purples"
                placeholderTextColor="#666"
                value={imagePrompt}
                onChangeText={setImagePrompt}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            
            {customDeckImages[selectedPhenomena || ''] && (
              <View style={styles.currentImageContainer}>
                <Text style={styles.currentImageLabel}>Current Image:</Text>
                <Image
                  source={{ uri: customDeckImages[selectedPhenomena || ''] }}
                  style={styles.currentImage}
                  resizeMode="cover"
                />
              </View>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.generateButton,
                  (!imagePrompt.trim() || generatingImage) && styles.generateButtonDisabled,
                ]}
                onPress={handleGenerateImage}
                disabled={!imagePrompt.trim() || generatingImage}
              >
                {generatingImage ? (
                  <Text style={styles.generateButtonText}>Generating…</Text>
                ) : (
                  <>
                    <Wand2 size={20} color="#fff" />
                    <Text style={styles.generateButtonText}>Generate</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.uploadButton]}
                onPress={handleImageUpload}
                disabled={uploadingImage}
              >
                <Upload size={20} color="#fff" />
                <Text style={styles.uploadButtonText}>
                  {uploadingImage ? 'Uploading...' : 'Upload Image'}
                </Text>
              </TouchableOpacity>
              
              {customDeckImages[selectedPhenomena || ''] && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.removeButton]}
                  onPress={handleRemoveImage}
                  disabled={uploadingImage}
                >
                  <Trash2 size={20} color="#fff" />
                  <Text style={styles.removeButtonText}>Remove Image</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  frozenAddSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  customizationSection: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#ccc',
    marginBottom: 24,
    lineHeight: 20,
  },
  addSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginBottom: 12,
  },
  addInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#fff',
    marginRight: 12,
  },
  addButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listSection: {
    flex: 1,
  },
  topSection: {
    flex: 1,
    marginBottom: 20,
  },
  bottomSection: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  resetButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#ef4444',
  },
  cardGridContent: {
    paddingBottom: 20,
    paddingHorizontal: CARD_MARGIN,
  },
  cardRow: {
    justifyContent: 'space-between',
    marginBottom: CARD_MARGIN * 2,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginHorizontal: CARD_MARGIN / 2,
  },
  phenomenaCard: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardLayer: {
    position: 'absolute',
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  cardLayer3: {
    width: '95%',
    height: '98%',
    top: 6,
    left: '2.5%',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  cardLayer2: {
    width: '98%',
    height: '99%',
    top: 3,
    left: '1%',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  cardContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    height: 32,
  },
  cardTitle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  phenomenaCardName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginBottom: 4,
  },
  deckLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  cardFooter: {
    alignItems: 'center',
    marginTop: 8,
  },
  cardCountIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  defaultBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  defaultBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  removeButtonCard: {
    backgroundColor: 'rgba(239,68,68,0.8)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  deckImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },
  imageCardName: {
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  imageDeckLabel: {
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#ccc',
    marginBottom: 20,
    lineHeight: 20,
  },
  promptGroup: {
    marginBottom: 16,
  },
  promptLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginBottom: 8,
  },
  promptInput: {
    backgroundColor: '#111213',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#fff',
    minHeight: 72,
  },
  currentImageContainer: {
    marginBottom: 20,
  },
  currentImageLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginBottom: 8,
  },
  currentImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  generateButton: {
    backgroundColor: '#6d28d9',
  },
  generateButtonDisabled: {
    backgroundColor: '#3b3b3b',
  },
  generateButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
  },
  uploadButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  removeButton: {
    backgroundColor: '#FF3B30',
  },
  removeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
});
