import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal, Alert, Platform } from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Trash2, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const PHENOMENA_STORAGE_KEY = '@phenomena_types';
const DEFAULT_PHENOMENA = ['Intention', 'Context', 'Impact', 'Accuracy', 'Agenda', 'Needs', 'Emotion', 'Role'];

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

  // Load saved phenomena types on component mount
  useEffect(() => {
    loadPhenomenaTypes();
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
        console.error('Error loading phenomena types from database:', dbError);
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
      console.error('Error loading phenomena types:', error);
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
      console.error('Error loading from AsyncStorage:', error);
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
      console.error('Error migrating from AsyncStorage:', error);
    }
  };

  const savePhenomenaTypes = async (types: string[]) => {
    try {
      if (!user) {
        console.error('No user found for saving phenomena types');
        return;
      }

      // Save to database
      const { error } = await supabase
        .from('users')
        .update({ custom_phenomena_types: types })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving phenomena types to database:', error);
        // Fall back to AsyncStorage
        await AsyncStorage.setItem(PHENOMENA_STORAGE_KEY, JSON.stringify(types));
      }
    } catch (error) {
      console.error('Error saving phenomena types:', error);
      // Fall back to AsyncStorage
      try {
        await AsyncStorage.setItem(PHENOMENA_STORAGE_KEY, JSON.stringify(types));
      } catch (storageError) {
        console.error('Error saving to AsyncStorage:', storageError);
      }
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
      
      <View style={styles.content}>
        <Text style={styles.subtitle}>Customize Card Phenomena Types</Text>
        <Text style={styles.description}>
          Add or remove phenomena types that will appear in the card creation dropdown.
        </Text>

        {/* Add New Phenomena */}
        <View style={styles.addSection}>
          <Text style={styles.sectionTitle}>Add New Phenomena Type</Text>
          <View style={styles.addInputContainer}>
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
        </View>

        {/* Current Phenomena Types */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Current Phenomena Types ({phenomenaTypes.length})</Text>
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={resetToDefaults}
            >
              <Text style={styles.resetButtonText}>Reset to Defaults</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={phenomenaTypes}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isDefault = DEFAULT_PHENOMENA.includes(item);
              return (
                <View style={styles.phenomenaItem}>
                  <View style={styles.phenomenaInfo}>
                    <Text style={styles.phenomenaName}>{item}</Text>
                    {isDefault && <Text style={styles.defaultBadge}>Default</Text>}
                  </View>
                  {!isDefault && (
                    <TouchableOpacity 
                      style={styles.removeButton}
                      onPress={() => removePhenomena(item)}
                    >
                      <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        </View>
      </View>
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
  content: {
    flex: 1,
    padding: 20,
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
  listContent: {
    paddingBottom: 20,
  },
  phenomenaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  phenomenaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  phenomenaName: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#fff',
    marginRight: 8,
  },
  defaultBadge: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    backgroundColor: '#6366f1',
    color: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  removeButton: {
    padding: 4,
  },
});
