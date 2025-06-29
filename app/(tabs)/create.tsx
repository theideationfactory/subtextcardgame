import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import { Wand2, PlusCircle } from 'lucide-react-native';

SplashScreen.preventAutoHideAsync();

export default function CreateScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>
        Card Creation Options
      </Text>
      
      {/* Card creation options row */}
      <View style={styles.optionsContainer}>
        <Pressable 
          style={styles.optionCard}
          onPress={() => router.push('/(tabs)/card-creation-new')}
        >
          <View style={styles.optionIconContainer}>
            <PlusCircle size={32} color="#6366f1" />
          </View>
          <Text style={styles.optionTitle}>Create New Card</Text>
          <Text style={styles.optionDescription}>Design a custom card with your own text and AI-generated image</Text>
        </Pressable>

        
        <Pressable 
          style={[styles.optionCard, styles.comingSoonCard]}
          onPress={() => router.push('/(tabs)/ai-card-flow')}
        >
          <View style={styles.optionIconContainer}>
            <Wand2 size={32} color="#888" />
          </View>
          <Text style={styles.optionTitle}>AI Card Flow</Text>
          <Text style={styles.optionDescription}>Generate multiple cards in a guided AI-powered flow (Coming Soon)</Text>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Coming Soon</Text>
          </View>
        </Pressable>
        
        <Pressable style={[styles.optionCard, styles.comingSoonCard]}>
          <View style={styles.optionIconContainer}>
            <Wand2 size={32} color="#888" />
          </View>
          <Text style={styles.optionTitle}>AI Suggestion</Text>
          <Text style={styles.optionDescription}>Let AI suggest card ideas based on your preferences (Coming Soon)</Text>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Coming Soon</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    padding: 16,
  },
  screenTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'column',
    gap: 16,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  comingSoonCard: {
    opacity: 0.7,
    position: 'relative',
  },
  optionIconContainer: {
    marginBottom: 12,
  },
  optionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#fff',
    marginBottom: 8,
  },
  optionDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: '#aaa',
  },
});