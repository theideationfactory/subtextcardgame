import { useState, useEffect, useRef } from 'react';
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
import { ArrowLeft, ChevronRight, ChevronLeft, ChevronDown, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

// Get screen dimensions for responsive layout
const { width } = Dimensions.get('window');

// Mock card data - in real implementation, these would be generated based on selected cards
const MOCK_CARD_DATA = {
  '1': { 
    name: 'Emotional Deflection', 
    description: 'Redirecting emotional content away from oneself, often by changing the subject or focus of conversation.',
    type: 'Impact',
    role: 'Protector',
    context: 'Therapy',
    imagePrompt: 'A person holding up a mirror that reflects emotions in different directions'
  },
  '2': { 
    name: 'Boundary Setting', 
    description: 'Clearly communicating personal limits and expectations in a conversation or relationship.',
    type: 'Protect',
    role: 'Gatekeeper',
    context: 'Self',
    imagePrompt: 'A person drawing a glowing line in the sand between themselves and others'
  },
  '3': { 
    name: 'Empathetic Listening', 
    description: 'Fully attending to another person with genuine curiosity and without judgment or interruption.',
    type: 'Connect',
    role: 'Confessor',
    context: 'Friendship',
    imagePrompt: 'A person with large ears and a warm expression leaning forward attentively'
  },
  '4': { 
    name: 'Topic Shifting', 
    description: 'Deliberately changing the subject to avoid uncomfortable topics or redirect conversation flow.',
    type: 'Request',
    role: 'Entertainer',
    context: 'Family',
    imagePrompt: 'A person juggling different conversation bubbles, switching focus from one to another'
  },
  '5': { 
    name: 'Vulnerability Block', 
    description: 'Using humor, intellectualization, or distraction to prevent emotional exposure.',
    type: 'Protect',
    role: 'Protector',
    context: 'Work',
    imagePrompt: 'A person wearing armor with a shield, blocking emotional arrows'
  },
  '6': { 
    name: 'Perspective Taking', 
    description: "Temporarily adopting another's viewpoint to understand their experience and reasoning.",
    type: 'Percept',
    role: 'Advisor',
    context: 'Therapy',
    imagePrompt: 'A person looking through different colored lenses that show alternative viewpoints'
  },
  '7': { 
    name: 'Validation Seeking', 
    description: 'Fishing for affirmation or agreement to satisfy emotional needs or insecurities.',
    type: 'Request',
    role: 'Judge',
    context: 'Friendship',
    imagePrompt: 'A person holding up their work for approval, with anxious expression'
  },
  '8': { 
    name: 'Emotional Mirroring', 
    description: 'Reflecting back the emotional state of another person to build connection and understanding.',
    type: 'Connect',
    role: 'Confessor',
    context: 'Therapy',
    imagePrompt: 'Two faces with identical emotional expressions, connected by glowing lines'
  },
};

// Type and role options from the existing app
const typeOptions = ['TBD', 'Impact', 'Request', 'Protect', 'Connect', 'Percept'];
const roleOptions = ['TBD', 'Advisor', 'Confessor', 'Judge', 'Peacemaker', 'Provocateur', 'Entertainer', 'Gatekeeper'];
const contextOptions = ['TBD', 'Self', 'Family', 'Friendship', 'Therapy', 'Peer', 'Work', 'Art', 'Politics'];

export default function AICardFlowStep3() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const selectedCardIds = (params.selectedCards as string || '').split(',');
  const conversationPrompt = params.prompt as string || '';
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardData, setCardData] = useState<Record<string, any>>({});
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  
  // Simulate API call to get card descriptions
  useEffect(() => {
    const timer = setTimeout(() => {
      // Filter mock data to only include selected cards
      const selectedCardData: Record<string, any> = {};
      selectedCardIds.forEach(id => {
        if (MOCK_CARD_DATA[id as keyof typeof MOCK_CARD_DATA]) {
          selectedCardData[id] = { ...MOCK_CARD_DATA[id as keyof typeof MOCK_CARD_DATA] };
        }
      });
      
      setCardData(selectedCardData);
      setIsLoading(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [selectedCardIds]);
  
  const currentCardId = selectedCardIds[currentCardIndex];
  const currentCard = cardData[currentCardId];
  const totalCards = selectedCardIds.length;
  
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
  
  const handleDescriptionChange = (text: string) => {
    if (!currentCardId || !cardData[currentCardId]) return;
    
    setCardData(prev => ({
      ...prev,
      [currentCardId]: {
        ...prev[currentCardId],
        description: text
      }
    }));
  };
  
  const handleTypeSelect = (type: string) => {
    if (!currentCardId || !cardData[currentCardId]) return;
    
    setCardData(prev => ({
      ...prev,
      [currentCardId]: {
        ...prev[currentCardId],
        type
      }
    }));
    
    setShowTypeDropdown(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };
  
  const handleRoleSelect = (role: string) => {
    if (!currentCardId || !cardData[currentCardId]) return;
    
    setCardData(prev => ({
      ...prev,
      [currentCardId]: {
        ...prev[currentCardId],
        role
      }
    }));
    
    setShowRoleDropdown(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };
  
  const handleContextSelect = (context: string) => {
    if (!currentCardId || !cardData[currentCardId]) return;
    
    setCardData(prev => ({
      ...prev,
      [currentCardId]: {
        ...prev[currentCardId],
        context
      }
    }));
    
    setShowContextDropdown(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };
  
  const handleContinue = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // In a real implementation, you would navigate to the next step
    // with the card data
    // router.push({
    //   pathname: '/(tabs)/ai-card-flow-step4',
    //   params: { 
    //     cardData: JSON.stringify(cardData),
    //     selectedCards: selectedCardIds.join(','),
    //     prompt: conversationPrompt
    //   }
    // });
  };
  
  const renderDropdown = (
    visible: boolean,
    options: string[],
    selectedValue: string,
    onSelect: (value: string) => void,
    onClose: () => void
  ) => {
    if (!visible) return null;
    
    return (
      <View style={styles.dropdownOverlay}>
        <TouchableOpacity 
          style={styles.dropdownBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.dropdownContainer}>
          <ScrollView style={styles.dropdownScroll}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.dropdownItem}
                onPress={() => onSelect(option)}
              >
                <Text style={styles.dropdownItemText}>{option}</Text>
                {selectedValue === option && (
                  <Check size={20} color="#6366f1" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
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
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <Text style={styles.stepText}>Edit card descriptions</Text>
        </View>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Generating card descriptions...</Text>
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
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{currentCard.name}</Text>
                    <View style={styles.cardTypeIndicator}>
                      <Text style={styles.cardTypeText}>{currentCard.type}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.placeholderImage}>
                    <Text style={styles.placeholderImageText}>Card Image</Text>
                    <Text style={styles.placeholderImageSubtext}>(Generated in next step)</Text>
                  </View>
                  
                  <Text style={styles.previewDescription} numberOfLines={3} ellipsizeMode="tail">
                    {currentCard.description}
                  </Text>
                  
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardMetaText}>Role: {currentCard.role}</Text>
                    <Text style={styles.cardMetaText}>Context: {currentCard.context}</Text>
                  </View>
                </View>
                
                <View style={styles.editorSection}>
                  <Text style={styles.editorLabel}>Description</Text>
                  <TextInput
                    style={styles.descriptionInput}
                    multiline
                    value={currentCard.description}
                    onChangeText={handleDescriptionChange}
                    placeholder="Enter card description..."
                    placeholderTextColor="#666"
                    maxLength={200}
                  />
                  <Text style={styles.characterCount}>
                    {currentCard.description.length}/200
                  </Text>
                </View>
                
                <View style={styles.editorSection}>
                  <Text style={styles.editorLabel}>Card Type</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => setShowTypeDropdown(true)}
                  >
                    <Text style={styles.dropdownSelectorText}>{currentCard.type}</Text>
                    <ChevronDown size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.editorSection}>
                  <Text style={styles.editorLabel}>Card Role</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => setShowRoleDropdown(true)}
                  >
                    <Text style={styles.dropdownSelectorText}>{currentCard.role}</Text>
                    <ChevronDown size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.editorSection}>
                  <Text style={styles.editorLabel}>Context</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => setShowContextDropdown(true)}
                  >
                    <Text style={styles.dropdownSelectorText}>{currentCard.context}</Text>
                    <ChevronDown size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>Continue to image generation</Text>
              <ChevronRight size={20} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      
      {/* Dropdowns */}
      {renderDropdown(
        showTypeDropdown,
        typeOptions,
        currentCard?.type || '',
        handleTypeSelect,
        () => setShowTypeDropdown(false)
      )}
      
      {renderDropdown(
        showRoleDropdown,
        roleOptions,
        currentCard?.role || '',
        handleRoleSelect,
        () => setShowRoleDropdown(false)
      )}
      
      {renderDropdown(
        showContextDropdown,
        contextOptions,
        currentCard?.context || '',
        handleContextSelect,
        () => setShowContextDropdown(false)
      )}
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
    width: 40, // Same width as back button for balance
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
  cardTypeIndicator: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cardTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  placeholderImage: {
    height: 140,
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
  previewDescription: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMetaText: {
    color: '#888',
    fontSize: 12,
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  dropdownSelector: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownSelectorText: {
    color: '#fff',
    fontSize: 16,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dropdownContainer: {
    width: '80%',
    maxHeight: 300,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  dropdownScroll: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dropdownItemText: {
    color: '#fff',
    fontSize: 16,
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
