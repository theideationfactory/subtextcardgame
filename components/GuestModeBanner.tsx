import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

type GuestModeBannerProps = {
  onUpgrade?: () => void;
};

export default function GuestModeBanner({ onUpgrade }: GuestModeBannerProps) {
  const router = useRouter();

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onUpgrade) {
      onUpgrade();
    } else {
      router.push('/upgrade-account' as any);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <AlertCircle size={20} color="#f59e0b" style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Guest Mode</Text>
          <Text style={styles.subtitle}>Sign up to save your cards permanently</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleUpgrade} activeOpacity={0.8}>
        <UserPlus size={16} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  buttonIcon: {
    marginRight: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
