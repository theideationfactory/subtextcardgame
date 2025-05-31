import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Platform,
  Image,
  KeyboardAvoidingView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronRight, ChevronLeft, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// Art style options
const artStyleOptions = [
  'Fantasy (MTG-inspired)',
  'Photorealistic',
  'Anime',
  'Digital Art',
];

// Mock card data for image prompts (should be passed in real flow)
const MOCK_CARD_IMAGE_DATA = {
  '1': {
    name: 'Emotional Deflection',
    imagePrompt: 'A person holding up a mirror that reflects emotions in different directions',
    artStyle: 'Fantasy (MTG-inspired)'
  },
  '2': {
    name: 'Boundary Setting',
    imagePrompt: 'A person drawing a glowing line in the sand between themselves and others',
    artStyle: 'Fantasy (MTG-inspired)'
  },
  '3': {
    name: 'Empathetic Listening',
    imagePrompt: 'A person with large ears and a warm expression leaning forward attentively',
    artStyle: 'Fantasy (MTG-inspired)'
  },
};

export default function AICardFlowStep4() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const selectedCardIds = (params.selectedCards as string || '').split(',');
  const conversationPrompt = params.prompt as string || '';
  // In real flow, cardData would be passed as JSON
  // const cardData = params.cardData ? JSON.parse(params.cardData as string) : {};
  const [isLoading, setIsLoading] = useState(true);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardImageData, setCardImageData] = useState<Record<string, any>>({});

  useEffect(() => {
    // Simulate API call to get AI image prompts
    const timer = setTimeout(() => {
      // Only include selected cards
      const selected: Record<string, any> = {};
      selectedCardIds.forEach(id => {
        if (MOCK_CARD_IMAGE_DATA[id as keyof typeof MOCK_CARD_IMAGE_DATA]) {
          selected[id] = { ...MOCK_CARD_IMAGE_DATA[id as keyof typeof MOCK_CARD_IMAGE_DATA] };
        } else {
          selected[id] = {
            name: `Card ${id}`,
            imagePrompt: '',
            artStyle: 'Fantasy (MTG-inspired)'
          };
        }
      });
      setCardImageData(selected);
      setIsLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [selectedCardIds]);

  const totalCards = selectedCardIds.length;
  const currentCardId = selectedCardIds[currentCardIndex];
  const currentCard = cardImageData[currentCardId];

  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleNextCard = () => {
    if (currentCardIndex < totalCards - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleImagePromptChange = (text: string) => {
    if (!currentCardId || !cardImageData[currentCardId]) return;
    setCardImageData(prev => ({
      ...prev,
      [currentCardId]: {
        ...prev[currentCardId],
        imagePrompt: text
      }
    }));
  };

  const handleArtStyleSelect = (style: string) => {
    if (!currentCardId || !cardImageData[currentCardId]) return;
    setCardImageData(prev => ({
      ...prev,
      [currentCardId]: {
        ...prev[currentCardId],
        artStyle: style
      }
    }));
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleContinue = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Navigate to the review screen with all card data
    router.push({
      pathname: '/ai-card-flow-review' as any,
      params: { 
        cardData: JSON.stringify(cardImageData),
        selectedCards: selectedCardIds.join(','),
        prompt: conversationPrompt
      }
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Create Cards</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stepIndicator}>
          <View style={styles.stepBubble}>
            <Text style={styles.stepNumber}>4</Text>
          </View>
          <Text style={styles.stepText}>Edit image descriptions</Text>
        </View>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Generating image prompts...</Text>
          </View>
        ) : (
          <>
            <View style={styles.cardProgress}>
              <Text style={styles.cardProgressText}>
                Card {currentCardIndex + 1} of {totalCards}
              </Text>
              <View style={styles.cardNavigation}>
                <TouchableOpacity
                  style={[styles.navButton, currentCardIndex === 0 && styles.navButtonDisabled]}
                  onPress={handlePrevCard}
                  disabled={currentCardIndex === 0}
                >
                  <ChevronLeft size={20} color={currentCardIndex === 0 ? '#666' : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.navButton, currentCardIndex === totalCards - 1 && styles.navButtonDisabled]}
                  onPress={handleNextCard}
                  disabled={currentCardIndex === totalCards - 1}
                >
                  <ChevronRight size={20} color={currentCardIndex === totalCards - 1 ? '#666' : '#fff'} />
                </TouchableOpacity>
              </View>
            </View>
            {currentCard && (
              <View style={styles.cardEditor}>
                <View style={styles.cardPreview}>
                  <Text style={styles.cardName}>{currentCard.name}</Text>
                  <View style={styles.placeholderImage}>
                    <Text style={styles.placeholderImageText}>Image Preview</Text>
                    <Text style={styles.placeholderImageSubtext}>(Generated after this step)</Text>
                  </View>
                </View>
                <View style={styles.editorSection}>
                  <Text style={styles.editorLabel}>Image Description</Text>
                  <TextInput
                    style={styles.descriptionInput}
                    multiline
                    value={currentCard.imagePrompt}
                    onChangeText={handleImagePromptChange}
                    placeholder="Describe the image for this card..."
                    placeholderTextColor="#666"
                    maxLength={200}
                  />
                  <Text style={styles.characterCount}>
                    {currentCard.imagePrompt.length}/200
                  </Text>
                </View>
                <View style={styles.editorSection}>
                  <Text style={styles.editorLabel}>Art Style</Text>
                  <View style={styles.artStyleRow}>
                    {artStyleOptions.map(style => (
                      <TouchableOpacity
                        key={style}
                        style={[
                          styles.artStyleOption,
                          currentCard.artStyle === style && styles.artStyleOptionSelected
                        ]}
                        onPress={() => handleArtStyleSelect(style)}
                      >
                        <Text
                          style={[
                            styles.artStyleOptionText,
                            currentCard.artStyle === style && styles.artStyleOptionTextSelected
                          ]}
                        >
                          {style}
                        </Text>
                        {currentCard.artStyle === style && <Check size={16} color="#10b981" style={styles.artStyleCheck} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>Finish & Review Cards</Text>
              <ChevronRight size={20} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#aaa',
    fontSize: 16,
    marginTop: 16,
  },
  cardProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardProgressText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  cardNavigation: {
    flexDirection: 'row',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  navButtonDisabled: {
    backgroundColor: '#1a1a1a',
    opacity: 0.5,
  },
  cardEditor: {
    marginBottom: 24,
  },
  cardPreview: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  cardName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  placeholderImage: {
    height: 140,
    width: '100%',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
  editorSection: {
    marginBottom: 16,
  },
  editorLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  descriptionInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  characterCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  artStyleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  artStyleOption: {
    backgroundColor: '#23234a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  artStyleOptionSelected: {
    backgroundColor: '#10b981',
  },
  artStyleOptionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  artStyleOptionTextSelected: {
    color: '#121212',
  },
  artStyleCheck: {
    marginLeft: 6,
  },
  continueButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});
