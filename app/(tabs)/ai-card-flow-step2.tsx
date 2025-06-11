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
  Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronRight, RefreshCw, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

// Card type icons (simplified for now)
import { Zap, Shield, HandHeart, MessageCircle, Eye } from 'lucide-react-native';

// Get screen dimensions for responsive layout
const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2; // 2 cards per row with margins

// Mock card suggestions - in real implementation, these would come from an API
const MOCK_CARD_SUGGESTIONS = [
  { id: '1', name: 'Emotional Deflection', type: 'Impact', icon: Zap },
  { id: '2', name: 'Boundary Setting', type: 'Protect', icon: Shield },
  { id: '3', name: 'Empathetic Listening', type: 'Connect', icon: HandHeart },
  { id: '4', name: 'Topic Shifting', type: 'Request', icon: MessageCircle },
  { id: '5', name: 'Vulnerability Block', type: 'Protect', icon: Shield },
  { id: '6', name: 'Perspective Taking', type: 'Percept', icon: Eye },
  { id: '7', name: 'Validation Seeking', type: 'Request', icon: MessageCircle },
  { id: '8', name: 'Emotional Mirroring', type: 'Connect', icon: HandHeart },
];

export default function AICardFlowStep2() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const conversationPrompt = params.prompt as string || '';
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [cardSuggestions, setCardSuggestions] = useState<typeof MOCK_CARD_SUGGESTIONS>([]);
  
  // Simulate API call to get card suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      setCardSuggestions(MOCK_CARD_SUGGESTIONS);
      setIsLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleCardSelect = (cardId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    setSelectedCards(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      } else {
        return [...prev, cardId];
      }
    });
  };
  
  const handleRegenerate = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    setIsRegenerating(true);
    
    // Simulate API call to regenerate suggestions
    setTimeout(() => {
      // In a real implementation, you would call an API to get new suggestions
      // For now, we'll just shuffle the existing ones
      setCardSuggestions([...MOCK_CARD_SUGGESTIONS].sort(() => Math.random() - 0.5));
      setIsRegenerating(false);
    }, 1500);
  };
  
  const handleContinue = () => {
    if (selectedCards.length === 0) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Navigate to step 3 with the selected card IDs and the original prompt
    router.push({
      pathname: '/(tabs)/ai-card-flow-step3',
      params: { 
        selectedCards: selectedCards.join(','),
        prompt: conversationPrompt
      }
    });
  };
  
  const renderCardItem = ({ item }: { item: typeof MOCK_CARD_SUGGESTIONS[0] }) => {
    const isSelected = selectedCards.includes(item.id);
    const IconComponent = item.icon;
    
    return (
      <TouchableOpacity
        style={[styles.cardItem, isSelected && styles.cardItemSelected]}
        onPress={() => handleCardSelect(item.id)}
        activeOpacity={0.7}
      >
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <CheckCircle2 size={20} color="#6366f1" />
          </View>
        )}
        <View style={[styles.cardTypeIndicator, getTypeColor(item.type)]}>
          <IconComponent size={16} color="#fff" />
        </View>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardType}>{item.type}</Text>
      </TouchableOpacity>
    );
  };
  
  return (
    <View style={styles.container}>
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
      >
        <View style={styles.stepIndicator}>
          <View style={styles.stepBubble}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <Text style={styles.stepText}>Select cards to create</Text>
        </View>
        
        <View style={styles.promptContainer}>
          <Text style={styles.promptLabel}>Based on your conversation:</Text>
          <Text style={styles.promptText} numberOfLines={2} ellipsizeMode="tail">
            {conversationPrompt || "Your described conversation"}
          </Text>
        </View>
        
        <Text style={styles.selectionTitle}>
          Select the cards that best represent the conversation dynamics:
        </Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Analyzing conversation...</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={cardSuggestions}
              renderItem={renderCardItem}
              keyExtractor={item => item.id}
              numColumns={2}
              scrollEnabled={false}
              contentContainerStyle={styles.cardsGrid}
            />
            
            <View style={styles.selectionInfo}>
              <Text style={styles.selectionCount}>
                {selectedCards.length} card{selectedCards.length !== 1 ? 's' : ''} selected
              </Text>
              
              <TouchableOpacity
                style={styles.regenerateButton}
                onPress={handleRegenerate}
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  <ActivityIndicator size="small" color="#6366f1" />
                ) : (
                  <>
                    <RefreshCw size={16} color="#6366f1" style={styles.regenerateIcon} />
                    <Text style={styles.regenerateText}>Regenerate suggestions</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[
                styles.continueButton,
                selectedCards.length === 0 && styles.continueButtonDisabled
              ]}
              onPress={handleContinue}
              disabled={selectedCards.length === 0}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>Continue with selected cards</Text>
              <ChevronRight size={20} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Helper function to get color based on card type
function getTypeColor(type: string) {
  switch (type) {
    case 'Impact':
      return styles.typeImpact;
    case 'Request':
      return styles.typeRequest;
    case 'Protect':
      return styles.typeProtect;
    case 'Connect':
      return styles.typeConnect;
    case 'Percept':
      return styles.typePercept;
    default:
      return {};
  }
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
  promptContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  promptLabel: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 4,
  },
  promptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
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
  cardsGrid: {
    marginHorizontal: -8,
  },
  cardItem: {
    width: cardWidth,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    borderWidth: 1,
    borderColor: '#333',
    position: 'relative',
  },
  cardItemSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#2a2a42',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  cardTypeIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardType: {
    color: '#aaa',
    fontSize: 14,
  },
  typeImpact: {
    backgroundColor: '#f43f5e', // Pink
  },
  typeRequest: {
    backgroundColor: '#8b5cf6', // Purple
  },
  typeProtect: {
    backgroundColor: '#10b981', // Green
  },
  typeConnect: {
    backgroundColor: '#3b82f6', // Blue
  },
  typePercept: {
    backgroundColor: '#f59e0b', // Amber
  },
  selectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  selectionCount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  regenerateIcon: {
    marginRight: 8,
  },
  regenerateText: {
    color: '#6366f1',
    fontSize: 14,
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
  continueButtonDisabled: {
    backgroundColor: '#3f3f46',
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});
