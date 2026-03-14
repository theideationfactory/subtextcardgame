import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  Dimensions, 
  ScrollView,
  Platform,
  Modal,
  TextInput,
  Alert,
  Image
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Users, Eye, Sparkles, Grid, Plus, Upload, Trash2, X, Wand2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { log, logError } from '@/utils/logger';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Card dimensions for portrait card deck style
const CARD_MARGIN = 8;
const CARDS_PER_ROW = 2;
const CARD_WIDTH = (screenWidth - 40 - (CARD_MARGIN * (CARDS_PER_ROW + 1))) / CARDS_PER_ROW;
const CARD_HEIGHT = CARD_WIDTH * 1.4; // Portrait aspect ratio

// Gradient colors for different phenomena types (same as deck creation)
const PHENOMENA_GRADIENTS: Record<string, [string, string]> = {
  'Intention': ['#6366f1', '#8b5cf6'],
  'Context': ['#0ea5e9', '#06b6d4'],
  'Impact': ['#f59e0b', '#ef4444'],
  'Accuracy': ['#10b981', '#059669'],
  'Agenda': ['#ec4899', '#be185d'],
  'Needs': ['#8b5cf6', '#6366f1'],
  'Emotion': ['#ef4444', '#dc2626'],
  'Role': ['#06b6d4', '#0891b2'],
  'default': ['#374151', '#1f2937'],
};

interface DetailOption {
  id: string;
  name: string;
  type: string;
  isAddButton?: boolean;
  isCustom?: boolean;
}

// Map of detail options for each Phenomena (same as card creation)
const subOptionsMap: Record<string, string[]> = {
  Intention: ['Impact', 'Request', 'Protect', 'Connect'],
  Role: ['Advisor', 'Confessor', 'Judge', 'Peacemaker', 'Provocateur', 'Entertainer', 'Gatekeeper'],
  Context: ['Setting', 'Timing', 'Relationship', 'Power'],
  Impact: ['Very Positive', 'Slightly Positive', 'Neutral', 'Slightly Negative', 'Very Negative'],
  Accuracy: ['Veridical', 'Mostly True', 'Distorted', 'Completely Off-Base', 'Manipulative'],
  Needs: ['Connection', 'Autonomy', 'Safety', 'Meaning', 'Play', 'Rest'],
  Emotion: ['Joy', 'Anger', 'Fear', 'Sadness', 'Surprise', 'Disgust', 'Love'],
  Agenda: ['Personal Gain', 'Group Harmony', 'Truth Seeking', 'Conflict Avoidance', 'Status Enhancement'],
};

export default function DeckDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  const [detailOptions, setDetailOptions] = useState<DetailOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOptionName, setNewOptionName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOption, setEditingOption] = useState<DetailOption | null>(null);
  const [editOptionName, setEditOptionName] = useState('');
  const lastTapRef = useRef<{optionId: string, time: number} | null>(null);

  // Image customization state for detail options
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedOptionName, setSelectedOptionName] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  // { [phenomenaType]: { [optionName]: imageUri } }
  const [customDetailImages, setCustomDetailImages] = useState<Record<string, Record<string, string>>>({});

  const phenomenaType = params.type as string || 'Unknown';
  const gradientColors = PHENOMENA_GRADIENTS[phenomenaType] || PHENOMENA_GRADIENTS.default;

  useEffect(() => {
    if (phenomenaType) {
      loadDetailOptionsForPhenomena();
    }
  }, [phenomenaType]);

  useEffect(() => {
    if (user?.id) {
      loadCustomDetailImages();
    }
  }, [user?.id]);

  const loadDetailOptionsForPhenomena = async () => {
    try {
      setLoading(true);
      
      // Get default options for this phenomena type
      const defaultOptions = subOptionsMap[phenomenaType] || [];
      
      // Fetch custom options from database
      let customOptions: string[] = [];
      if (user?.id) {
        const { data, error } = await supabase
          .from('users')
          .select('custom_detail_options')
          .eq('id', user.id)
          .single();
        
        if (error) {
          logError('Error fetching custom detail options:', error);
        } else if (data?.custom_detail_options?.[phenomenaType]) {
          customOptions = data.custom_detail_options[phenomenaType];
        }
      }
      
      // Combine default and custom options
      const allOptions = [...defaultOptions, ...customOptions];
      
      // Convert to DetailOption format with "add new" item first
      const detailOptions = [
        {
          id: 'add-new-option',
          name: 'Add New Option',
          type: phenomenaType,
          isAddButton: true
        },
        ...allOptions.map((option, index) => ({
          id: `${phenomenaType}-${index}`,
          name: option,
          type: phenomenaType,
          isCustom: customOptions.includes(option)
        }))
      ];
      
      setDetailOptions(detailOptions);
    } catch (error) {
      logError('Error loading detail options for phenomena:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load custom detail images from database
  const loadCustomDetailImages = async () => {
    try {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('users')
        .select('custom_detail_images')
        .eq('id', user.id)
        .single();
      if (error) {
        logError('Error fetching custom detail images:', error);
        return;
      }
      if (data?.custom_detail_images) {
        setCustomDetailImages(data.custom_detail_images as Record<string, Record<string, string>>);
      }
    } catch (e) {
      logError('Error loading custom detail images:', e);
    }
  };

  // Save custom detail images to database
  const saveCustomDetailImages = async (images: Record<string, Record<string, string>>) => {
    try {
      if (!user?.id) return;
      const { error } = await supabase
        .from('users')
        .update({ custom_detail_images: images })
        .eq('id', user.id);
      if (error) {
        logError('Error saving custom detail images:', error);
      }
    } catch (e) {
      logError('Error saving custom detail images:', e);
    }
  };

  const handleCreateCard = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Navigate to card creation with preselected phenomena type
    router.push({
      pathname: '/card-creation-new',
      params: {
        preselected_type: phenomenaType,
        returnTo: 'deck-detail',
        returnPhenomena: phenomenaType
      }
    });
  };

  const handleViewOption = (option: DetailOption) => {
    if (option.isAddButton) {
      // Handle adding new option
      handleAddNewOption();
      return;
    }
    
    // Check for double tap on custom options only
    if (option.isCustom) {
      const now = Date.now();
      const lastTap = lastTapRef.current;
      
      if (lastTap && lastTap.optionId === option.id && now - lastTap.time < 300) {
        // Double tap detected - open edit modal
        handleEditOption(option);
        lastTapRef.current = null; // Reset to prevent triple tap
        return;
      }
      
      lastTapRef.current = { optionId: option.id, time: now };
    }
    
    // Single tap - add haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Could navigate to cards filtered by this specific detail option
    // For now, just provide haptic feedback
  };

  // Long press to customize image for a detail option
  const handleLongPressOption = (option: DetailOption) => {
    if (option.isAddButton) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    setSelectedOptionName(option.name);
    setShowImageModal(true);
  };

  // Upload image from library
  const handleImageUpload = async () => {
    try {
      if (!selectedOptionName) return;
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to upload images.');
        return;
      }
      setUploadingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [2.5, 3.5],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        const updated = { ...customDetailImages };
        if (!updated[phenomenaType]) updated[phenomenaType] = {};
        updated[phenomenaType][selectedOptionName] = imageUri;
        setCustomDetailImages(updated);
        await saveCustomDetailImages(updated);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        setShowImageModal(false);
        setSelectedOptionName(null);
      }
    } catch (err) {
      logError('Error uploading image:', err);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Remove image
  const handleRemoveImage = async () => {
    if (!selectedOptionName) return;
    const updated = { ...customDetailImages };
    if (updated[phenomenaType]) {
      delete updated[phenomenaType][selectedOptionName];
    }
    setCustomDetailImages(updated);
    await saveCustomDetailImages(updated);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setShowImageModal(false);
    setSelectedOptionName(null);
  };

  // Generate image via Supabase Edge Function
  const handleGenerateImage = async () => {
    if (!selectedOptionName) return;
    if (!imagePrompt.trim()) {
      Alert.alert('Add a description', 'Please describe the image you want for this option.');
      return;
    }
    try {
      setGeneratingImage(true);
      const { data, error } = await supabase.functions.invoke('generate-card-image', {
        body: {
          name: `${phenomenaType} - ${selectedOptionName}`,
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
      const updated = { ...customDetailImages };
      if (!updated[phenomenaType]) updated[phenomenaType] = {};
      updated[phenomenaType][selectedOptionName] = data.imageUrl as string;
      setCustomDetailImages(updated);
      await saveCustomDetailImages(updated);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setShowImageModal(false);
      setSelectedOptionName(null);
      setImagePrompt('');
    } catch (err) {
      logError('AI generation failed:', err);
      Alert.alert('Generation failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setGeneratingImage(false);
    }
  };
  
  const handleAddNewOption = () => {
    setNewOptionName('');
    setShowAddModal(true);
  };
  
  const handleSaveNewOption = async () => {
    if (!newOptionName.trim()) {
      Alert.alert('Error', 'Please enter an option name');
      return;
    }
    
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to add custom options');
      return;
    }
    
    try {
      setSaving(true);
      
      // Get current custom options
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('custom_detail_options')
        .eq('id', user.id)
        .single();
      
      if (fetchError) {
        throw fetchError;
      }
      
      const currentOptions = userData?.custom_detail_options || {};
      const phenomenaOptions = currentOptions[phenomenaType] || [];
      
      // Check if option already exists
      const allExistingOptions = [...(subOptionsMap[phenomenaType] || []), ...phenomenaOptions];
      if (allExistingOptions.some(opt => opt.toLowerCase() === newOptionName.trim().toLowerCase())) {
        Alert.alert('Error', 'This option already exists');
        return;
      }
      
      // Add new option to the phenomena type
      const updatedOptions = {
        ...currentOptions,
        [phenomenaType]: [...phenomenaOptions, newOptionName.trim()]
      };
      
      // Save to database
      const { error: updateError } = await supabase
        .from('users')
        .update({ custom_detail_options: updatedOptions })
        .eq('id', user.id);
      
      if (updateError) {
        logError('Error adding custom option:', updateError);
      }
      
      // Refresh the options list
      await loadDetailOptionsForPhenomena();
      
      // Close modal and reset
      setShowAddModal(false);
      setNewOptionName('');
      
      // Add haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
    } catch (error) {
      logError('Error adding custom option:', error);
      Alert.alert('Error', 'Failed to add custom option. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleCancelAddOption = () => {
    setShowAddModal(false);
    setNewOptionName('');
  };
  
  const handleEditOption = (option: DetailOption) => {
    setEditingOption(option);
    setEditOptionName(option.name);
    setShowEditModal(true);
  };
  
  const handleSaveEditOption = async () => {
    if (!editOptionName.trim()) {
      Alert.alert('Error', 'Please enter an option name');
      return;
    }
    
    if (!user?.id || !editingOption) {
      Alert.alert('Error', 'Unable to edit option');
      return;
    }
    
    try {
      setSaving(true);
      
      // Get current custom options
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('custom_detail_options')
        .eq('id', user.id)
        .single();
      
      if (fetchError) {
        throw fetchError;
      }
      
      const currentOptions = userData?.custom_detail_options || {};
      const phenomenaOptions = currentOptions[phenomenaType] || [];
      
      // Check if new name already exists (excluding current option)
      const allExistingOptions = [...(subOptionsMap[phenomenaType] || []), ...phenomenaOptions.filter((opt: string) => opt !== editingOption.name)];
      if (allExistingOptions.some((opt: string) => opt.toLowerCase() === editOptionName.trim().toLowerCase())) {
        Alert.alert('Error', 'This option already exists');
        return;
      }
      
      // Replace the old option with the new one
      const updatedPhenomenaOptions = phenomenaOptions.map((opt: string) => 
        opt === editingOption.name ? editOptionName.trim() : opt
      );
      
      const updatedOptions = {
        ...currentOptions,
        [phenomenaType]: updatedPhenomenaOptions
      };
      
      // Save to database
      const { error: updateError } = await supabase
        .from('users')
        .update({ custom_detail_options: updatedOptions })
        .eq('id', user.id);
      
      if (updateError) {
        logError('Error editing custom option:', updateError);
      }
      
      // Refresh the options list
      await loadDetailOptionsForPhenomena();
      
      // Close modal and reset
      setShowEditModal(false);
      setEditingOption(null);
      setEditOptionName('');
      
      // Add haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
    } catch (error) {
      logError('Error editing custom option:', error);
      Alert.alert('Error', 'Failed to edit option. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleDeleteOption = async () => {
    if (!user?.id || !editingOption) {
      Alert.alert('Error', 'Unable to delete option');
      return;
    }
    
    Alert.alert(
      'Delete Option',
      `Are you sure you want to delete "${editingOption.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              setSaving(true);
              
              // Get current custom options
              const { data: userData, error: fetchError } = await supabase
                .from('users')
                .select('custom_detail_options')
                .eq('id', user.id)
                .single();
              
              if (fetchError) {
                throw fetchError;
              }
              
              const currentOptions = userData?.custom_detail_options || {};
              const phenomenaOptions = currentOptions[phenomenaType] || [];
              
              // Remove the option
              const updatedPhenomenaOptions = phenomenaOptions.filter((opt: string) => opt !== editingOption.name);
              
              const updatedOptions = {
                ...currentOptions,
                [phenomenaType]: updatedPhenomenaOptions
              };
              
              // Save to database
              const { error: updateError } = await supabase
                .from('users')
                .update({ custom_detail_options: updatedOptions })
                .eq('id', user.id);
              
              if (updateError) {
                logError('Error deleting custom option:', updateError);
                throw updateError;
              }
              
              // Refresh the options list
              await loadDetailOptionsForPhenomena();
              
              // Close modal and reset
              setShowEditModal(false);
              setEditingOption(null);
              setEditOptionName('');
              
              // Add haptic feedback
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              
            } catch (error) {
              logError('Error deleting custom option:', error);
              Alert.alert('Error', 'Failed to delete option. Please try again.');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };
  
  const handleCancelEditOption = () => {
    setShowEditModal(false);
    setEditingOption(null);
    setEditOptionName('');
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading {phenomenaType} cards...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/deck-creation')}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{phenomenaType}</Text>
            <Text style={styles.headerSubtitle}>DECK</Text>
          </View>
          <View style={styles.cardCount}>
            <Text style={styles.cardCountText}>{detailOptions.length}</Text>
            <Text style={styles.cardCountLabel}>OPTIONS</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {detailOptions.length === 0 ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={[gradientColors[0] + '40', gradientColors[1] + '40']}
              style={styles.emptyCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Sparkles size={48} color="#fff" style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No {phenomenaType} Options</Text>
              <Text style={styles.emptySubtitle}>
                This phenomena type doesn't have predefined detail options yet.
              </Text>
            </LinearGradient>
            
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={handleCreateCard}
            >
              <LinearGradient
                colors={gradientColors}
                style={styles.createButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.createButtonText}>Create {phenomenaType} Card</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardsList}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>{phenomenaType} Detail Options ({detailOptions.length})</Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateCard}
              >
                <LinearGradient
                  colors={gradientColors}
                  style={styles.createButtonSmall}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.createButtonSmallText}>+ Create Card</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={detailOptions}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.cardRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleViewOption(item)}
                  onLongPress={() => handleLongPressOption(item)}
                  delayLongPress={300}
                  style={styles.cardContainer}
                >
                  {item.isAddButton ? (
                    <View style={styles.addNewCard}>
                      <View style={styles.addNewContent}>
                        <Plus size={40} color="#666" />
                        <Text style={styles.addNewText}>Add New{"\n"}Option</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.phenomenaCard}>
                      {/* Card stack layers */}
                      <View style={[styles.cardLayer, styles.cardLayer3]} />
                      <View style={[styles.cardLayer, styles.cardLayer2]} />
                      
                      {/* Background: custom image or gradient */}
                      {customDetailImages[phenomenaType]?.[item.name] ? (
                        <>
                          <Image
                            source={{ uri: customDetailImages[phenomenaType][item.name] }}
                            style={styles.deckImage}
                            resizeMode="cover"
                          />
                          <View style={styles.imageOverlay} />
                        </>
                      ) : (
                        <LinearGradient
                          colors={gradientColors}
                          style={[StyleSheet.absoluteFillObject, { borderRadius: 12 }]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        />
                      )}
                      
                      {/* Card content */}
                      <View style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                          <View style={styles.typeLabel}>
                            <Text style={styles.typeLabelText}>OPTION</Text>
                          </View>
                        </View>
                        
                        <View style={styles.cardTitle}>
                          <Text style={styles.phenomenaCardName}>{item.name}</Text>
                          <Text style={styles.optionLabel}>{item.type.toUpperCase()}</Text>
                        </View>
                        
                        <View style={styles.cardFooter}>
                          <View style={styles.cardCountIndicator}>
                            <View style={styles.cardCountDot} />
                            <View style={styles.cardCountDot} />
                            <View style={styles.cardCountDot} />
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.cardGridContent}
            />
          </View>
        )}
      </View>
      
      {/* Add New Option Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelAddOption}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New {phenomenaType} Option</Text>
            <TextInput
              style={styles.modalInput}
              value={newOptionName}
              onChangeText={setNewOptionName}
              placeholder="Enter option name..."
              placeholderTextColor="#666"
              autoFocus={true}
              maxLength={50}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelAddOption}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, saving && styles.disabledButton]}
                onPress={handleSaveNewOption}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Upload/Generate Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customize {phenomenaType} · {selectedOptionName}</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowImageModal(false)}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>
              Upload or generate an image for this detail option.
            </Text>
            <View style={styles.promptGroup}>
              <Text style={styles.promptLabel}>Describe the image</Text>
              <TextInput
                style={styles.promptInput}
                placeholder="e.g. Minimal geometric motif matching deck colors"
                placeholderTextColor="#666"
                value={imagePrompt}
                onChangeText={setImagePrompt}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            {!!(selectedOptionName && customDetailImages[phenomenaType]?.[selectedOptionName]) && (
              <View style={styles.currentImageContainer}>
                <Text style={styles.currentImageLabel}>Current Image:</Text>
                <Image
                  source={{ uri: customDetailImages[phenomenaType][selectedOptionName] }}
                  style={styles.currentImage}
                  resizeMode="cover"
                />
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.generateButton, (!imagePrompt.trim() || generatingImage) && styles.generateButtonDisabled]}
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
                <Text style={styles.uploadButtonText}>{uploadingImage ? 'Uploading...' : 'Upload Image'}</Text>
              </TouchableOpacity>
              {!!(selectedOptionName && customDetailImages[phenomenaType]?.[selectedOptionName]) && (
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
      
      {/* Edit/Delete Option Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelEditOption}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit {phenomenaType} Option</Text>
            <TextInput
              style={styles.modalInput}
              value={editOptionName}
              onChangeText={setEditOptionName}
              placeholder="Enter option name..."
              placeholderTextColor="#666"
              autoFocus={true}
              maxLength={50}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelEditOption}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteOption}
                disabled={saving}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, saving && styles.disabledButton]}
                onPress={handleSaveEditOption}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#ccc',
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
    padding: 4,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
  },
  headerGradient: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 2,
  },
  cardCount: {
    alignItems: 'center',
    paddingLeft: 16,
  },
  cardCountText: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  cardCountLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    width: CARD_WIDTH * 2 + CARD_MARGIN,
    height: CARD_HEIGHT,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyIcon: {
    opacity: 0.8,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  createFirstButton: {
    width: CARD_WIDTH * 2 + CARD_MARGIN,
  },
  createButtonGradient: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  cardsList: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  createButton: {
    // Style for create button
  },
  createButtonSmall: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  createButtonSmallText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
    borderRadius: 12,
  },
  cardLayer2: {
    width: '98%',
    height: '99%',
    top: 3,
    left: '1%',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
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
  typeLabel: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  typeLabelText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
  optionLabel: {
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
  addNewCard: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#444',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addNewContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNewText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 6,
    marginLeft: 12,
  },
  modalDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 12,
    textAlign: 'left',
  },
  promptGroup: {
    marginBottom: 16,
  },
  promptLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 6,
  },
  promptInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#fff',
    minHeight: 72,
  },
  // Back-compat: Some JSX still references modalInput
  modalInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#fff',
    minHeight: 72,
  },
  currentImageContainer: {
    marginBottom: 16,
  },
  currentImageLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  currentImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButton: {
    backgroundColor: '#7C3AED',
    flexDirection: 'row',
    gap: 8,
  },
  generateButtonDisabled: {
    backgroundColor: '#5b21b6',
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  uploadButton: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#7C3AED',
    flexDirection: 'row',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  removeButton: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    gap: 8,
  },
  removeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  deckImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  disabledButton: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  deleteButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
});
