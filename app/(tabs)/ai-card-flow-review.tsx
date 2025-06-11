import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Platform,
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Edit2, Trash2, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');
const cardWidth = width * 0.85; // Card takes most of the width for review

export default function AICardFlowReview() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const selectedCardIds = (params.selectedCards as string || '').split(',');
  const conversationPrompt = params.prompt as string || '';
  
  // In a real implementation, we'd parse the cardData from params
  // For now, we'll use mock data
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cardData, setCardData] = useState<Record<string, any>>({});
  
  // Mock data for review screen
  const MOCK_REVIEW_DATA = {
    '1': {
      name: 'Emotional Deflection',
      description: 'Redirecting emotional content away from oneself, often by changing the subject or focus of conversation.',
      type: 'Impact',
      role: 'Protector',
      context: 'Therapy',
      imagePrompt: 'A person holding up a mirror that reflects emotions in different directions',
      artStyle: 'Fantasy (MTG-inspired)'
    },
    '2': {
      name: 'Boundary Setting',
      description: 'Clearly communicating personal limits and expectations in a conversation or relationship.',
      type: 'Protect',
      role: 'Gatekeeper',
      context: 'Self',
      imagePrompt: 'A person drawing a glowing line in the sand between themselves and others',
      artStyle: 'Photorealistic'
    },
    '3': {
      name: 'Empathetic Listening',
      description: 'Fully attending to another person with genuine curiosity and without judgment or interruption.',
      type: 'Connect',
      role: 'Confessor',
      context: 'Friendship',
      imagePrompt: 'A person with large ears and a warm expression leaning forward attentively',
      artStyle: 'Anime'
    }
  };
  
  useEffect(() => {
    // In a real implementation, we'd parse the cardData from params
    // const parsedCardData = JSON.parse(params.cardData as string || '{}');
    
    // For now, we'll use mock data
    setCardData(MOCK_REVIEW_DATA);
  }, []);
  
  const handleSaveCards = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save cards');
      return;
    }
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    setIsSaving(true);
    
    try {
      // In a real implementation, we'd save the cards to Supabase
      // For each card in cardData:
      // 1. Generate the image (or queue it for generation)
      // 2. Save the card data to the database
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Success!
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      // Navigate to the inbox or home screen
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error saving cards:', error);
      Alert.alert('Error', 'Failed to save cards. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleEditCard = (cardId: string) => {
    // In a real implementation, we'd navigate back to the appropriate step
    // For now, we'll just show an alert
    Alert.alert('Edit Card', `Editing card ${cardId}. This would navigate back to the edit screen.`);
  };
  
  const handleDeleteCard = (cardId: string) => {
    // Remove the card from the list
    const newCardData = { ...cardData };
    delete newCardData[cardId];
    setCardData(newCardData);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };
  
  const renderCardItem = ({ item }: { item: string }) => {
    const card = cardData[item];
    if (!card) return null;
    
    return (
      <View style={styles.cardReview}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>{card.name}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity 
              style={styles.cardAction}
              onPress={() => handleEditCard(item)}
            >
              <Edit2 size={18} color="#6366f1" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cardAction}
              onPress={() => handleDeleteCard(item)}
            >
              <Trash2 size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderImageText}>Card Image</Text>
          <Text style={styles.placeholderImageSubtext}>(Will be generated)</Text>
        </View>
        
        <View style={styles.cardDetails}>
          <View style={styles.cardDetailRow}>
            <Text style={styles.cardDetailLabel}>Type:</Text>
            <Text style={styles.cardDetailValue}>{card.type}</Text>
          </View>
          <View style={styles.cardDetailRow}>
            <Text style={styles.cardDetailLabel}>Role:</Text>
            <Text style={styles.cardDetailValue}>{card.role}</Text>
          </View>
          <View style={styles.cardDetailRow}>
            <Text style={styles.cardDetailLabel}>Context:</Text>
            <Text style={styles.cardDetailValue}>{card.context}</Text>
          </View>
        </View>
        
        <View style={styles.cardDescription}>
          <Text style={styles.cardDescriptionLabel}>Description:</Text>
          <Text style={styles.cardDescriptionText}>{card.description}</Text>
        </View>
        
        <View style={styles.cardImagePrompt}>
          <Text style={styles.cardImagePromptLabel}>Image Prompt:</Text>
          <Text style={styles.cardImagePromptText}>{card.imagePrompt}</Text>
          <Text style={styles.cardArtStyle}>Art Style: {card.artStyle}</Text>
        </View>
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Review Cards</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewTitle}>
            {Object.keys(cardData).length} Cards Ready to Create
          </Text>
          <Text style={styles.reviewSubtitle}>
            Review your cards before saving them to your collection
          </Text>
        </View>
        
        <View style={styles.conversationPrompt}>
          <Text style={styles.conversationPromptLabel}>Based on your conversation:</Text>
          <Text style={styles.conversationPromptText}>{conversationPrompt}</Text>
        </View>
        
        {Object.keys(cardData).length > 0 ? (
          <FlatList
            data={Object.keys(cardData)}
            renderItem={renderCardItem}
            keyExtractor={item => item}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No cards selected</Text>
          </View>
        )}
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              Object.keys(cardData).length === 0 && styles.saveButtonDisabled
            ]}
            onPress={handleSaveCards}
            disabled={Object.keys(cardData).length === 0 || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Check size={20} color="#fff" style={styles.saveButtonIcon} />
                <Text style={styles.saveButtonText}>Save All Cards</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.createSpreadButton}
            disabled={Object.keys(cardData).length === 0 || isSaving}
          >
            <Share2 size={20} color="#fff" style={styles.createSpreadButtonIcon} />
            <Text style={styles.createSpreadButtonText}>Create Spread</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerRight: {
    width: 40,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  reviewHeader: {
    marginBottom: 24,
  },
  reviewTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  reviewSubtitle: {
    fontSize: 16,
    color: '#aaa',
  },
  conversationPrompt: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  conversationPromptLabel: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 4,
  },
  conversationPromptText: {
    color: '#fff',
    fontSize: 16,
    fontStyle: 'italic',
  },
  cardReview: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    width: cardWidth,
    alignSelf: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
  },
  cardAction: {
    padding: 8,
    marginLeft: 8,
  },
  placeholderImage: {
    height: 160,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderImageText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  placeholderImageSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  cardDetails: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  cardDetailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cardDetailLabel: {
    color: '#aaa',
    fontSize: 14,
    width: 70,
  },
  cardDetailValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  cardDescription: {
    marginBottom: 12,
  },
  cardDescriptionLabel: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 4,
  },
  cardDescriptionText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  cardImagePrompt: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
  },
  cardImagePromptLabel: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 4,
  },
  cardImagePromptText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardArtStyle: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
  },
  actionButtons: {
    marginTop: 24,
  },
  saveButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#3f3f46',
    opacity: 0.7,
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createSpreadButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createSpreadButtonIcon: {
    marginRight: 8,
  },
  createSpreadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
