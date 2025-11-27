import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Palette,
  Target,
  Shield,
  Book,
  Heart,
  MessageCircle,
  Lightbulb,
  Users,
  Sparkles,
  Settings,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Available icons for zones
const ZONE_ICONS = [
  { name: 'Target', icon: Target, color: '#FF6B6B' },
  { name: 'Shield', icon: Shield, color: '#4ECDC4' },
  { name: 'Book', icon: Book, color: '#45B7D1' },
  { name: 'Heart', icon: Heart, color: '#F093FB' },
  { name: 'Message', icon: MessageCircle, color: '#FD79A8' },
  { name: 'Lightbulb', icon: Lightbulb, color: '#FDCB6E' },
  { name: 'Users', icon: Users, color: '#6C5CE7' },
  { name: 'Sparkles', icon: Sparkles, color: '#A29BFE' },
  { name: 'Settings', icon: Settings, color: '#FD79A8' },
];

// Available colors for spreads
const SPREAD_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#F093FB', '#FD79A8',
  '#FDCB6E', '#6C5CE7', '#A29BFE', '#FF9800', '#E91E63',
  '#9C27B0', '#2196F3', '#4CAF50', '#FF5722', '#795548'
];

interface CustomZone {
  id: string;
  name: string;
  title: string;
  description: string;
  color: string;
  icon: string;
}

interface CustomSpread {
  name: string;
  description: string;
  color: string;
  zones: CustomZone[];
}

export default function CustomSpreadBuilder() {
  const router = useRouter();
  const { user } = useAuth();
  const [spreadName, setSpreadName] = useState('');
  const [spreadDescription, setSpreadDescription] = useState('');
  const [spreadColor, setSpreadColor] = useState(SPREAD_COLORS[0]);
  const [zones, setZones] = useState<CustomZone[]>([
    {
      id: '1',
      name: 'zone_1',
      title: 'Zone 1',
      description: 'Enter a description for this zone',
      color: SPREAD_COLORS[1],
      icon: 'Target',
    }
  ]);
  const [saving, setSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activeColorTarget, setActiveColorTarget] = useState<'spread' | string>('spread');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<CustomSpread[]>([]);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  const addZone = () => {
    if (zones.length >= 6) {
      Alert.alert('Limit Reached', 'You can have a maximum of 6 zones in a spread.');
      return;
    }

    const newZone: CustomZone = {
      id: Date.now().toString(),
      name: `zone_${zones.length + 1}`,
      title: `Zone ${zones.length + 1}`,
      description: 'Enter a description for this zone',
      color: SPREAD_COLORS[(zones.length + 1) % SPREAD_COLORS.length],
      icon: ZONE_ICONS[zones.length % ZONE_ICONS.length].name,
    };

    setZones([...zones, newZone]);
  };

  const removeZone = (zoneId: string) => {
    if (zones.length <= 1) {
      Alert.alert('Cannot Remove', 'A spread must have at least one zone.');
      return;
    }

    setZones(zones.filter(zone => zone.id !== zoneId));
  };

  const updateZone = (zoneId: string, field: keyof CustomZone, value: string) => {
    setZones(zones.map(zone => 
      zone.id === zoneId 
        ? { ...zone, [field]: value, name: field === 'title' ? value.toLowerCase().replace(/\s+/g, '_') : zone.name }
        : zone
    ));
  };

  const handleColorSelect = (color: string) => {
    if (activeColorTarget === 'spread') {
      setSpreadColor(color);
    } else {
      updateZone(activeColorTarget, 'color', color);
    }
    setShowColorPicker(false);
  };

  const handleIconSelect = (zoneId: string, iconName: string) => {
    updateZone(zoneId, 'icon', iconName);
  };

  const loadSavedTemplates = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('custom_spread_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const templates = data?.map(template => ({
        name: template.name,
        description: template.description,
        color: template.color,
        zones: template.zones
      })) || [];
      
      setSavedTemplates(templates);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const saveAsTemplateInDB = async (customSpread: CustomSpread) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('custom_spread_templates')
        .insert({
          user_id: user.id,
          name: customSpread.name,
          description: customSpread.description,
          color: customSpread.color,
          zones: customSpread.zones,
          is_public: false
        });

      if (error) throw error;
      
      Alert.alert('Success', 'Template saved successfully!');
      loadSavedTemplates(); // Refresh templates
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Failed to save template. Please try again.');
    }
  };

  const loadTemplate = (template: CustomSpread) => {
    setSpreadName(template.name);
    setSpreadDescription(template.description);
    setSpreadColor(template.color);
    setZones(template.zones);
    setShowTemplateSelector(false);
  };

  const validateSpread = (): boolean => {
    if (!spreadName.trim()) {
      Alert.alert('Missing Name', 'Please enter a name for your spread.');
      return false;
    }

    if (!spreadDescription.trim()) {
      Alert.alert('Missing Description', 'Please enter a description for your spread.');
      return false;
    }

    for (const zone of zones) {
      if (!zone.title.trim()) {
        Alert.alert('Missing Zone Title', 'Please enter a title for all zones.');
        return false;
      }
      if (!zone.description.trim()) {
        Alert.alert('Missing Zone Description', 'Please enter a description for all zones.');
        return false;
      }
    }

    return true;
  };

  const saveCustomSpread = async () => {
    if (!validateSpread()) return;

    setSaving(true);
    try {
      // Create the custom spread object
      const customSpread: CustomSpread = {
        name: spreadName,
        description: spreadDescription,
        color: spreadColor,
        zones: zones,
      };

      console.log('Custom spread object created:', customSpread);

      // Always save as template for future use, plus save if explicitly requested
      await saveAsTemplateInDB(customSpread);

      // Navigate back to spread screen with custom spread data
      // Use encodeURIComponent to safely pass JSON through URL params
      const jsonString = JSON.stringify(customSpread);
      const encodedString = encodeURIComponent(jsonString);
      
      console.log('JSON string:', jsonString);
      console.log('Encoded string length:', encodedString.length);
      
      router.replace({
        pathname: '/(tabs)/spread',
        params: {
          customSpread: encodedString,
        }
      });

    } catch (error) {
      console.error('Error saving custom spread:', error);
      Alert.alert('Error', 'Failed to create custom spread. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderZoneEditor = (zone: CustomZone, index: number) => {
    const IconComponent = ZONE_ICONS.find(icon => icon.name === zone.icon)?.icon || Target;

    return (
      <View key={zone.id} style={[styles.zoneEditor, { borderLeftColor: zone.color }]}>
        <View style={styles.zoneHeader}>
          <View style={styles.zoneHeaderLeft}>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: `${zone.color}20` }]}
              onPress={() => {/* Icon selector modal could be added here */}}
            >
              <IconComponent size={20} color={zone.color} />
            </TouchableOpacity>
            <Text style={styles.zoneNumber}>Zone {index + 1}</Text>
          </View>
          <View style={styles.zoneHeaderRight}>
            <TouchableOpacity
              style={[styles.colorButton, { backgroundColor: zone.color }]}
              onPress={() => {
                setActiveColorTarget(zone.id);
                setShowColorPicker(true);
              }}
            >
              <Palette size={16} color="#fff" />
            </TouchableOpacity>
            {zones.length > 1 && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => removeZone(zone.id)}
              >
                <Trash2 size={16} color="#ff4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TextInput
          style={styles.zoneInput}
          placeholder="Zone Title"
          placeholderTextColor="#666"
          value={zone.title}
          onChangeText={(text) => updateZone(zone.id, 'title', text)}
        />

        <TextInput
          style={[styles.zoneInput, styles.zoneDescriptionInput]}
          placeholder="Zone Description"
          placeholderTextColor="#666"
          value={zone.description}
          onChangeText={(text) => updateZone(zone.id, 'description', text)}
          multiline
          numberOfLines={3}
        />
      </View>
    );
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Create Custom Spread</Text>
        <TouchableOpacity 
          style={styles.templateButton}
          onPress={() => {
            loadSavedTemplates();
            setShowTemplateSelector(true);
          }}
        >
          <Book size={20} color="#6366f1" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Spread Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spread Details</Text>
          
          <View style={styles.spreadColorRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Spread Name"
              placeholderTextColor="#666"
              value={spreadName}
              onChangeText={setSpreadName}
            />
            <TouchableOpacity
              style={[styles.colorButton, { backgroundColor: spreadColor }]}
              onPress={() => {
                setActiveColorTarget('spread');
                setShowColorPicker(true);
              }}
            >
              <Palette size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.input, styles.descriptionInput]}
            placeholder="Spread Description"
            placeholderTextColor="#666"
            value={spreadDescription}
            onChangeText={setSpreadDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Zones Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Zones ({zones.length}/6)</Text>
            <TouchableOpacity
              style={[styles.addZoneButton, zones.length >= 6 && styles.addZoneButtonDisabled]}
              onPress={addZone}
              disabled={zones.length >= 6}
            >
              <Plus size={20} color={zones.length >= 6 ? "#666" : "#fff"} />
            </TouchableOpacity>
          </View>

          {zones.map((zone, index) => renderZoneEditor(zone, index))}
        </View>

        {/* Preview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <LinearGradient
            colors={[`${spreadColor}33`, `${spreadColor}11`]}
            style={styles.previewCard}
          >
            <Text style={styles.previewTitle}>{spreadName || 'Spread Name'}</Text>
            <Text style={styles.previewDescription}>{spreadDescription || 'Spread description'}</Text>
            <View style={styles.previewZones}>
              {zones.map((zone, index) => {
                const IconComponent = ZONE_ICONS.find(icon => icon.name === zone.icon)?.icon || Target;
                return (
                  <View key={zone.id} style={styles.previewZone}>
                    <IconComponent size={16} color={zone.color} />
                    <Text style={styles.previewZoneTitle}>{zone.title}</Text>
                  </View>
                );
              })}
            </View>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomActions}>
        <View style={styles.checkboxContainer}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setSaveAsTemplate(!saveAsTemplate)}
          >
            {saveAsTemplate && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <Text style={styles.checkboxLabel}>Save as template</Text>
        </View>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.saveButton, (!spreadName.trim() || !spreadDescription.trim()) && styles.saveButtonDisabled]}
            onPress={saveCustomSpread}
            disabled={!spreadName.trim() || !spreadDescription.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Save size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Create Spread</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Color Picker Modal */}
      {showColorPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.colorPickerModal}>
            <Text style={styles.colorPickerTitle}>Choose Color</Text>
            <View style={styles.colorGrid}>
              {SPREAD_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorOption, { backgroundColor: color }]}
                  onPress={() => handleColorSelect(color)}
                />
              ))}
            </View>
            <TouchableOpacity
              style={styles.colorPickerCancel}
              onPress={() => setShowColorPicker(false)}
            >
              <Text style={styles.colorPickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <View style={styles.modalOverlay}>
          <View style={styles.templateModal}>
            <Text style={styles.templateModalTitle}>Load Template</Text>
            {savedTemplates.length === 0 ? (
              <Text style={styles.noTemplatesText}>No saved templates found.</Text>
            ) : (
              <ScrollView style={styles.templateList}>
                {savedTemplates.map((template, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.templateItem, { borderLeftColor: template.color }]}
                    onPress={() => loadTemplate(template)}
                  >
                    <Text style={styles.templateItemName}>{template.name}</Text>
                    <Text style={styles.templateItemDescription}>{template.description}</Text>
                    <Text style={styles.templateItemZones}>{template.zones.length} zones</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.templateModalCancel}
              onPress={() => setShowTemplateSelector(false)}
            >
              <Text style={styles.templateModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Inter-Bold',
    flex: 1,
  },
  templateButton: {
    padding: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    fontFamily: 'Inter-Bold',
  },
  spreadColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addZoneButton: {
    backgroundColor: '#6366f1',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addZoneButtonDisabled: {
    backgroundColor: '#333',
  },
  zoneEditor: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  zoneHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  zoneHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Inter-Bold',
  },
  deleteButton: {
    padding: 8,
  },
  zoneInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 6,
    padding: 10,
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
  },
  zoneDescriptionInput: {
    height: 60,
    textAlignVertical: 'top',
    marginBottom: 0,
  },
  previewCard: {
    borderRadius: 12,
    padding: 16,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'Inter-Bold',
  },
  previewDescription: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
  },
  previewZones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewZone: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  previewZoneTitle: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'Inter-Regular',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#6366f1',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#333',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPickerModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxWidth: 300,
  },
  colorPickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  colorPickerCancel: {
    alignItems: 'center',
    padding: 12,
  },
  colorPickerCancelText: {
    color: '#6366f1',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  templateModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
  },
  templateModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
  },
  noTemplatesText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 20,
    fontFamily: 'Inter-Regular',
  },
  templateList: {
    maxHeight: 300,
  },
  templateItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  templateItemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: 'Inter-Bold',
  },
  templateItemDescription: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'Inter-Regular',
  },
  templateItemZones: {
    color: '#6366f1',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  templateModalCancel: {
    alignItems: 'center',
    padding: 12,
    marginTop: 16,
  },
  templateModalCancelText: {
    color: '#6366f1',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
});
