import { useState, useEffect, useContext, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView,
  StyleSheet, 
  TextInput,
  Switch,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Trash2, Save, Wand2, Settings, Palette, Type, Layout, Image as ImageIcon } from 'lucide-react-native';

SplashScreen.preventAutoHideAsync();

interface CustomGenerationType {
  id: string;
  name: string;
  description: string;
  theme: string;
  special_instructions: string;
  is_active: boolean;
  user_id: string;
  created_at: string;
}

export default function CustomGenerationBuilderScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  // State for custom generation types
  const [customTypes, setCustomTypes] = useState<CustomGenerationType[]>([]);
  const [selectedType, setSelectedType] = useState<CustomGenerationType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<CustomGenerationType | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isActive, setIsActive] = useState(true);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load custom generation types
  const loadCustomTypes = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('custom_generation_types')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomTypes(data || []);
    } catch (err) {
      console.error('Error loading custom generation types:', err);
      setError('Failed to load custom generation types');
    } finally {
      setLoading(false);
    }
  };

  // Save custom generation type
  const saveCustomType = async () => {
    if (!user) return;
    
    if (!name.trim()) {
      setError('Please enter a name for your generation type');
      return;
    }

    if (!theme.trim()) {
      setError('Please enter a theme for your generation type');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const typeData = {
        name: name.trim(),
        description: description.trim(),
        theme: theme.trim(),
        special_instructions: specialInstructions.trim(),
        is_active: isActive,
        user_id: user.id,
      };

      if (isEditing && selectedType) {
        // Update existing type
        const { error } = await supabase
          .from('custom_generation_types')
          .update(typeData)
          .eq('id', selectedType.id);

        if (error) throw error;
        setSuccessMessage('Custom generation type updated successfully!');
      } else {
        // Create new type
        const { error } = await supabase
          .from('custom_generation_types')
          .insert(typeData);

        if (error) throw error;
        setSuccessMessage('Custom generation type created successfully!');
      }

      // Reset form and reload
      resetForm();
      await loadCustomTypes();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (err) {
      console.error('Error saving custom generation type:', err);
      setError('Failed to save custom generation type');
    } finally {
      setSaving(false);
    }
  };

  // Delete custom generation type
  const deleteCustomType = async (type: CustomGenerationType) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('custom_generation_types')
        .delete()
        .eq('id', type.id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setCustomTypes(customTypes.filter(t => t.id !== type.id));
      setShowDeleteModal(false);
      setTypeToDelete(null);
      setSuccessMessage('Custom generation type deleted successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (err) {
      console.error('Error deleting custom generation type:', err);
      setError('Failed to delete custom generation type');
    }
  };

  // Reset form
  const resetForm = () => {
    setName('');
    setDescription('');
    setTheme('');
    setSpecialInstructions('');
    setIsActive(true);
    setIsEditing(false);
    setSelectedType(null);
  };

  // Edit custom type
  const editCustomType = (type: CustomGenerationType) => {
    setSelectedType(type);
    setName(type.name);
    setDescription(type.description);
    setTheme(type.theme);
    setSpecialInstructions(type.special_instructions);
    setIsActive(type.is_active);
    setIsEditing(true);
  };

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      loadCustomTypes();
    }, [user])
  );

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Custom Generation Builder</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success/Error Messages */}
        {successMessage ? (
          <View style={styles.successMessage}>
            <Text style={styles.successMessageText}>{successMessage}</Text>
          </View>
        ) : null}
        
        {error ? (
          <View style={styles.errorMessage}>
            <Text style={styles.errorMessageText}>{error}</Text>
          </View>
        ) : null}

        {/* Existing Custom Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Custom Generation Types</Text>
          
          {loading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : customTypes.length === 0 ? (
            <View style={styles.emptyState}>
              <Settings size={48} color="#666" />
              <Text style={styles.emptyStateText}>No custom generation types yet</Text>
              <Text style={styles.emptyStateSubtext}>Create your first custom generation type below</Text>
            </View>
          ) : (
            <View style={styles.typesList}>
              {customTypes.map((type) => (
                <View key={type.id} style={styles.typeCard}>
                  <View style={styles.typeHeader}>
                    <Text style={styles.typeName}>{type.name}</Text>
                    <View style={styles.typeActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => editCustomType(type)}
                      >
                        <Settings size={16} color="#6366f1" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          setTypeToDelete(type);
                          setShowDeleteModal(true);
                        }}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.typeDescription}>{type.description}</Text>
                  <View style={styles.typeDetails}>
                    <Text style={styles.typeDetail}>Theme: {type.theme}</Text>
                    <Text style={styles.typeDetail}>Active: {type.is_active ? 'Yes' : 'No'}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Create/Edit Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isEditing ? 'Edit Custom Generation Type' : 'Create New Custom Generation Type'}
          </Text>

          {/* Basic Info */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter generation type name"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your custom generation type"
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Theme */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Theme</Text>
            <TextInput
              style={styles.input}
              value={theme}
              onChangeText={setTheme}
              placeholder="e.g., Cyberpunk, Fantasy, Steampunk, Minimalist"
              placeholderTextColor="#666"
            />
            <Text style={styles.helpText}>
              Enter the artistic theme for your cards (e.g., cyberpunk, fantasy, steampunk, minimalist)
            </Text>
          </View>

          {/* Special Instructions */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Special Instructions</Text>
            
            {/* Quick Add Bubbles */}
            <View style={styles.quickAddContainer}>
              <TouchableOpacity
                style={styles.quickAddBubble}
                onPress={() => {
                  const newText = specialInstructions 
                    ? `${specialInstructions}\nCard should be on black background`
                    : 'Card should be on black background';
                  setSpecialInstructions(newText);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={styles.quickAddText}>+ Black Background</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.quickAddBubble}
                onPress={() => {
                  const newText = specialInstructions 
                    ? `${specialInstructions}\nPlace symbols in the card's empty space`
                    : "Place symbols in the card's empty space";
                  setSpecialInstructions(newText);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={styles.quickAddText}>+ Symbols in Empty Space</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={[styles.input, styles.textArea]}
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              placeholder="Any special styling requests or additional details..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
            />
            <Text style={styles.helpText}>
              Optional: Add any special instructions for the AI to follow when generating your cards
            </Text>
          </View>

          {/* Active Toggle */}
          <View style={styles.toggleGroup}>
            <Text style={styles.label}>Active</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: '#374151', true: '#6366f1' }}
              thumbColor={isActive ? '#fff' : '#9ca3af'}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={resetForm}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveCustomType}
              disabled={saving}
            >
              <Save size={20} color="#fff" />
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Custom Generation Type</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete "{typeToDelete?.name}"? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={() => typeToDelete && deleteCustomType(typeToDelete)}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
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
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: '#1e1e1e',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#fff',
    marginBottom: 16,
  },
  successMessage: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successMessageText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#fff',
  },
  errorMessage: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorMessageText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#fff',
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  typesList: {
    gap: 12,
  },
  typeCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  typeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeName: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  typeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#374151',
  },
  typeDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#aaa',
    marginBottom: 12,
  },
  typeDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  typeDetail: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#999',
  },
  inputGroup: {
    marginBottom: 20,
  },
  rowInputGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  halfInputGroup: {
    flex: 1,
  },
  label: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectorButton: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  selectorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  helpText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  quickAddContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  quickAddBubble: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  quickAddText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#e5e7eb',
  },
  toggleGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#374151',
  },
  cancelButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#6366f1',
  },
  saveButtonDisabled: {
    backgroundColor: '#4c1d95',
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 20,
    maxWidth: 400,
    width: '100%',
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#fff',
    marginBottom: 12,
  },
  modalMessage: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#aaa',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#374151',
  },
  modalCancelText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
  },
  modalDeleteButton: {
    backgroundColor: '#ef4444',
  },
  modalDeleteText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
  },
});
