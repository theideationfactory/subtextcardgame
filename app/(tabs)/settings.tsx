import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import { createClient } from '@supabase/supabase-js';
import { Spacer } from '@/components/Spacer';
import * as Haptics from 'expo-haptics';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

SplashScreen.preventAutoHideAsync();

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const handleConnectWallet = () => {
    // In a real implementation, this would connect to a wallet like MetaMask or WalletConnect
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Simulating wallet connection for demo purposes
    setTimeout(() => {
      const mockWalletAddress = '0x' + Math.random().toString(16).substring(2, 42);
      setWalletAddress(mockWalletAddress);
      setWalletConnected(true);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Wallet Connected',
        `Connected to wallet: ${mockWalletAddress.substring(0, 6)}...${mockWalletAddress.substring(38)}`,
        [{ text: 'OK' }]
      );
    }, 1000);
  };

  const handleDisconnectWallet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setWalletConnected(false);
    setWalletAddress('');
    Alert.alert('Wallet Disconnected', 'Your wallet has been disconnected.');
  };

  return (
    <View style={styles.container}>
      {/* Spacer removed for consistent padding across tabs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.setting}>
          <Text style={styles.settingText}>Dark Mode</Text>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: '#3e3e3e', true: '#007AFF' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.setting}>
          <Text style={styles.settingText}>Enable Notifications</Text>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: '#3e3e3e', true: '#007AFF' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Web3 & NFTs</Text>
        {!walletConnected ? (
          <TouchableOpacity 
            style={[styles.button, styles.web3Button]}
            onPress={handleConnectWallet}
          >
            <Text style={styles.buttonText}>Connect Wallet</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.setting}>
              <Text style={styles.settingText}>Wallet</Text>
              <Text style={styles.walletAddress}>
                {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.button, styles.dangerButton]}
              onPress={handleDisconnectWallet}
            >
              <Text style={styles.buttonText}>Disconnect Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.web3Button]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert(
                  'Mint Card as NFT',
                  'This will allow you to mint your Subtext cards as NFTs on the Polygon network.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Go to Cards', 
                      onPress: () => router.push('/') 
                    }
                  ]
                );
              }}
            >
              <Text style={styles.buttonText}>Mint Card as NFT</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Export Collection</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.signOutButton]}
          onPress={handleSignOut}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.dangerButton]}>
          <Text style={styles.buttonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#fff',
    marginBottom: 16,
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#fff',
  },
  button: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  signOutButton: {
    backgroundColor: '#6366f1',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
  },
  web3Button: {
    backgroundColor: '#8247E5', // Polygon/Matic purple
  },
  walletAddress: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#a3a3a3',
  },
});