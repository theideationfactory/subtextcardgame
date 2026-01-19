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
  Image,
  Platform,
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronRight, ChevronLeft, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { log, logError } from '@/utils/logger';

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

// Dropdown options matching card-creation-new.tsx
const typeOptions = ['Intention', 'Context', 'Impact', 'Accuracy', 'Agenda', 'Needs', 'Emotion', 'Role'];
const detailOptions: Record<string, string[]> = {
  Intention: ['Impact', 'Request', 'Protect', 'Connect'],
  Role: ['Advisor', 'Confessor', 'Judge', 'Peacemaker', 'Provocateur', 'Entertainer', 'Gatekeeper'],
  Context: ['Setting', 'Timing', 'Relationship', 'Power'],
};
const contextOptions = ['TBD', 'Self', 'Family', 'Friendship', 'Therapy', 'Peer', 'Work', 'Art', 'Politics'];

export default function AICardFlowStep3() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const selectedCardIds = (params.selectedCards as string || '').split(',');
  const conversationPrompt = params.prompt as string || '';
  
  const [isLoading, setIsLoading] = useState(true);
  const [cardData, setCardData] = useState<Record<string, any>>({});

  // Auto-generate cards using foreground generation
  useEffect(() => {
    const generateCards = async () => {
      try {
        const passedCardData = params.cardData as string;
        if (passedCardData) {
          const parsedCards = JSON.parse(passedCardData);
          
          // Initialize card data with pending status
          const initialCardData: Record<string, any> = {};
          parsedCards.forEach((card: any) => {
            initialCardData[card.id] = {
              ...card,
              status: 'pending'
            };
          });
          setCardData(initialCardData);
          setIsLoading(false);

          // Generate cards in foreground
          await generateCardsInForeground(parsedCards);
        }
      } catch (error) {
        logError('Error setting up card generation:', error);
        setCardData({});
        setIsLoading(false);
      }
    };

    generateCards();
  }, [params.cardData]);

  const generateCardsInForeground = async (parsedCards: any[]) => {
    // Get current user (works for both authenticated and anonymous users)
    const { data: { user } } = await supabase.auth.getUser();
    
    for (const card of parsedCards) {
      try {
        // Update status to processing
        setCardData(prev => ({
          ...prev,
          [card.id]: { ...prev[card.id], status: 'processing' }
        }));

        // Generate image description
        const { data: imageDescData, error: imageDescError } = await supabase.functions.invoke('generate-image-description', {
          body: { 
            cardName: card.name,
            cardType: card.type !== 'TBD' ? card.type : undefined,
            cardDescription: card.description || undefined
          },
        });

        const imageDescription = imageDescData?.imageDescription || card.description;

        // Create job in queue directly
        const { data: { user } } = await supabase.auth.getUser();
        const { data: job, error: queueError } = await supabase
          .from('image_generation_queue')
          .insert({
            user_id: user?.id,
            card_data: {
              name: card.name,
              description: imageDescription,
              type: card.type,
              role: card.role,
              context: card.context,
              format: 'fullBleed',
              size: '1024x1536',
              quality: 'auto',
              generation_type: 'enhanced'
            },
            status: 'queued'
          })
          .select()
          .single();

        if (queueError) {
          logError('❌ Error creating job:', queueError);
          setCardData(prev => ({
            ...prev,
            [card.id]: {
              ...card,
              isGenerating: false,
              status: 'error',
              error: 'Failed to queue card generation'
            }
          }));
          continue;
        }

        log('✅ Job created:', job.id);

        // Trigger processing function directly
        const { error: processError } = await supabase.functions.invoke('process-full-bleed-card-generation', {
          body: { jobId: job.id }
        });

        if (processError) {
          logError('❌ Error triggering processor:', processError);
        } else {
          log('✅ Processor triggered for job:', job.id);
        }

        setCardData(prev => ({
          ...prev,
          [card.id]: {
            ...card,
            isGenerating: true,
            status: 'generating',
            jobId: job.id
          }
        }));
        
        // Poll for completion using check-job-status function
        const pollForCompletion = async () => {
          for (let i = 0; i < 60; i++) { // Poll for up to 2 minutes
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            
            const { data: jobResponse, error: jobError } = await supabase.functions.invoke('check-job-status', {
              body: { jobId: job.id }
            });
              
              if (jobError) {
                logError('❌ Error checking job status:', jobError);
                continue;
              }
              
              const jobStatus = jobResponse?.job;
              
              if (jobStatus?.status === 'completed' && jobStatus.image_url) {
                log('✅ Card generation completed:', jobStatus.image_url);
                
                // Save the card to the database
                try {
                  if (user) {
                    // Get or create collection
                    const { data: existingCollections } = await supabase
                      .from('collections')
                      .select('id')
                      .eq('user_id', user.id)
                      .limit(1);

                    let collectionId = null;
                    if (existingCollections && existingCollections.length > 0) {
                      collectionId = existingCollections[0].id;
                    } else {
                      const { data: newCollection } = await supabase
                        .from('collections')
                        .insert({
                          name: 'My Collection',
                          user_id: user.id,
                          is_public: false
                        })
                        .select()
                        .single();
                      collectionId = newCollection?.id;
                    }

                    // Save the card
                    const { data: savedCard, error: saveError } = await supabase
                      .from('cards')
                      .insert({
                        name: card.name,
                        description: card.description,
                        type: card.type,
                        role: card.role || 'TBD',
                        context: card.context || 'TBD',
                        image_url: jobStatus.image_url,
                        user_id: user.id,
                        collection_id: collectionId,
                        format: 'fullBleed',
                        is_premium_generation: true,
                        is_public: false,
                        is_shared_with_friends: false
                      })
                      .select()
                      .single();

                    if (saveError) {
                      logError('❌ Error saving card:', saveError);
                    } else {
                      log('✅ Card saved to database:', savedCard.id);
                    }
                  }
                } catch (saveErr) {
                  logError('❌ Error during card save:', saveErr);
                }

                setCardData(prev => ({
                  ...prev,
                  [card.id]: {
                    ...card,
                    isGenerating: false,
                    imageUrl: jobStatus.image_url,
                    status: 'completed'
                  }
                }));
                return;
              } else if (jobStatus?.status === 'failed') {
                logError('❌ Card generation failed:', jobStatus.error_message);
                setCardData(prev => ({
                  ...prev,
                  [card.id]: {
                    ...card,
                    isGenerating: false,
                    status: 'error',
                    error: jobStatus.error_message || 'Image generation failed'
                  }
                }));
                return;
              }
            }
            
            // Timeout
            logError('❌ Card generation timed out');
            setCardData(prev => ({
              ...prev,
              [card.id]: {
                ...card,
                isGenerating: false,
                status: 'error',
                error: 'Image generation timed out'
              }
            }));
          };
          
          pollForCompletion();
      } catch (error) {
        logError('Error generating card:', error);
        setCardData(prev => ({
          ...prev,
          [card.id]: {
            ...prev[card.id],
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }));
      }
    }
  };
  
  const totalCards = selectedCardIds.length;

  const handleContinue = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // Pass along cardData as JSON string, selectedCards, and prompt
    router.push({
      pathname: '/(tabs)/ai-card-flow-step4',
      params: {
        cardData: JSON.stringify(cardData),
        selectedCards: selectedCardIds.join(','),
        prompt: conversationPrompt,
      },
    });
  };
  
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

  // Helper function to get status indicator color
  function getStatusColor(status: string) {
    switch (status) {
      case 'completed':
        return { backgroundColor: '#4CAF50' };
      case 'error':
        return { backgroundColor: '#F44336' };
      default:
        return { backgroundColor: '#FF9800' };
    }
  }

  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerRight} />
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Generating cards with AI...</Text>
        </View>
      ) : (
        <>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.cardsContainer}
            contentContainerStyle={styles.cardsContentContainer}
          >
            {Object.values(cardData).map((card: any) => (
              <View key={card.id} style={styles.cardItem}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{card.name}</Text>
                  <View style={[styles.statusIndicator, getStatusColor(card.status)]}>
                    {card.status === 'completed' ? (
                      <Check size={16} color="#fff" />
                    ) : card.status === 'error' ? (
                      <Text style={styles.statusText}>!</Text>
                    ) : (
                      <ActivityIndicator size="small" color="#fff" />
                    )}
                  </View>
                </View>
                
                {card.imageUrl ? (
                  <Image source={{ uri: card.imageUrl }} style={styles.fullCardImage} />
                ) : card.status === 'processing' ? (
                  <View style={styles.cardPlaceholder}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.placeholderText}>Generating card...</Text>
                  </View>
                ) : null}
                
                {card.status === 'error' && (
                  <Text style={styles.errorText}>{card.error}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </>
      )}
      
      {!isLoading && Object.values(cardData).every((card: any) => card.status === 'completed' || card.status === 'error') && (
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>View your cards</Text>
            <ChevronRight size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
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
    width: 40, // Same width as back button for balance
  },
  backButton: {
    padding: 8,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 4,
  },
  typeImpact: {
    color: '#FF6B6B',
  },
  typeRequest: {
    color: '#4ECDC4',
  },
  typeProtect: {
    color: '#45B7D1',
  },
  typeConnect: {
    color: '#96CEB4',
  },
  typePercept: {
    color: '#FFEAA7',
  },
  statusCompleted: {
    color: '#4CAF50',
  },
  statusError: {
    color: '#F44336',
  },
  statusProcessing: {
    color: '#FF9800',
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  cardsContentContainer: {
    paddingRight: 20,
  },
  cardItem: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginRight: 20,
    borderWidth: 1,
    borderColor: '#444',
    width: 320, // Increased width for larger cards
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  cardPreviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  cardDescription: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    fontStyle: 'italic',
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
  inputWithIcon: {
    position: 'relative',
  },
  textAreaWithIcon: {
    paddingRight: 50,
  },
  inputIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputIconDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  generateButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  generateButtonDisabled: {
    backgroundColor: '#3f3f46',
    opacity: 0.7,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  descriptionButton: {
    alignSelf: 'flex-start',
  },
  buttonIcon: {
    marginRight: 8,
  },
  cardSubtitle: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  fullCardImage: {
    width: '100%',
    aspectRatio: 2/3, // Portrait card aspect ratio
    borderRadius: 12,
    marginBottom: 12,
  },
  cardPlaceholder: {
    width: '100%',
    aspectRatio: 2/3,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  bottomButtonContainer: {
    padding: 20,
    paddingBottom: 40,
  },
});
