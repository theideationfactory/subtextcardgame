import { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, HelpCircle, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function AICardFlowScreen() {
  const router = useRouter();
  const [conversationPrompt, setConversationPrompt] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Character count for minimum length
  const MIN_PROMPT_LENGTH = 20;
  const isPromptValid = conversationPrompt.trim().length >= MIN_PROMPT_LENGTH;

  const handleContinue = () => {
    if (!isPromptValid) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    Keyboard.dismiss();
    setIsLoading(true);
    
    // In a real implementation, you would make an API call here to generate suggestions
    // based on the conversation prompt
    setTimeout(() => {
      setIsLoading(false);
      // Navigate to step 2 with the prompt as a parameter
      router.push({
        pathname: '/(tabs)/ai-card-flow-step2',
        params: { prompt: conversationPrompt }
      });
    }, 1500);
  };

  const toggleExamples = () => {
    setShowExamples(!showExamples);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
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
            <Text style={styles.stepNumber}>1</Text>
          </View>
          <Text style={styles.stepText}>Describe the conversation</Text>
        </View>
        
        <Text style={styles.promptTitle}>What conversation moment do you want to explore?</Text>
        
        <Text style={styles.promptDescription}>
          Describe a conversation dynamic, difficult interaction, or communication pattern you've experienced.
        </Text>
        
        <TouchableOpacity 
          style={styles.examplesToggle}
          onPress={toggleExamples}
          activeOpacity={0.7}
        >
          <HelpCircle size={16} color="#6366f1" style={styles.examplesIcon} />
          <Text style={styles.examplesToggleText}>
            {showExamples ? 'Hide examples' : 'Show me examples'}
          </Text>
        </TouchableOpacity>
        
        {showExamples && (
          <View style={styles.examplesContainer}>
            <Text style={styles.exampleItem}>"My friend always changes the subject when I bring up my problems"</Text>
            <Text style={styles.exampleItem}>"The way my boss gives feedback makes me feel defensive"</Text>
            <Text style={styles.exampleItem}>"I notice I shut down when someone raises their voice"</Text>
          </View>
        )}
        
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          placeholder="Describe a conversation moment..."
          placeholderTextColor="#666"
          multiline
          textAlignVertical="top"
          value={conversationPrompt}
          onChangeText={setConversationPrompt}
          maxLength={300}
        />
        
        <View style={styles.characterCount}>
          <Text style={[styles.characterCountText, isPromptValid ? styles.characterCountValid : null]}>
            {conversationPrompt.length}/{MIN_PROMPT_LENGTH} characters minimum
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.continueButton, !isPromptValid && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!isPromptValid || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.continueButtonText}>Continue</Text>
              <ChevronRight size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
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
    marginTop: 0,
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
    marginBottom: 24,
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
  promptTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  promptDescription: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 16,
    lineHeight: 22,
  },
  examplesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  examplesIcon: {
    marginRight: 8,
  },
  examplesToggleText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  examplesContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  exampleItem: {
    color: '#ddd',
    fontSize: 14,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  textInput: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 150,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  characterCount: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  characterCountText: {
    color: '#666',
    fontSize: 12,
  },
  characterCountValid: {
    color: '#10b981', // Green color when valid
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
