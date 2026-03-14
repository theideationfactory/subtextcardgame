import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Modal, ScrollView, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { log, logError } from '@/utils/logger';
import 'react-native-url-polyfill/auto';

SplashScreen.preventAutoHideAsync();

const TOS_ACCEPTED_KEY = 'subtext_tos_accepted';
const TOS_VERSION = '2026-01-10'; // Update this when ToS changes

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTosModal, setShowTosModal] = useState(false);
  const [tosChecking, setTosChecking] = useState(true);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  const { refreshSession, signInAnonymously } = useAuth();

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Check if user has accepted ToS
  useEffect(() => {
    const checkTosAcceptance = async () => {
      try {
        const accepted = await AsyncStorage.getItem(TOS_ACCEPTED_KEY);
        if (accepted !== TOS_VERSION) {
          setShowTosModal(true);
        }
      } catch (err) {
        logError('Error checking ToS acceptance:', err);
        setShowTosModal(true);
      } finally {
        setTosChecking(false);
      }
    };
    checkTosAcceptance();
  }, []);

  const handleAcceptTos = async () => {
    try {
      await AsyncStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
      setShowTosModal(false);
    } catch (err) {
      logError('Error saving ToS acceptance:', err);
    }
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    if (isCloseToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const openPrivacyPolicy = () => {
    // You can replace this with your actual privacy policy URL
    Linking.openURL('https://openai.com/policies/usage-policies/');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // console.log('Attempting login...');
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        logError('Sign in error:', signInError);
        throw signInError;
      }

      // console.log('Sign in response:', data);

      if (data?.session) {
        // console.log('Session obtained, refreshing...');
        await refreshSession();
        
        if (Platform.OS !== 'web') {
          // Small delay for mobile to ensure session is properly set
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        router.replace('/(tabs)');
      } else {
        throw new Error('No session returned after login');
      }
    } catch (err: any) {
      logError('Login error:', err);
      setError(err.message || 'Failed to sign in');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    // Password strength validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // console.log('Attempting signup...');
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: Platform.OS === 'web' 
            ? window.location.origin 
            : 'myapp://'
        }
      });

      if (signUpError) {
        logError('Sign up error:', signUpError);
        throw signUpError;
      }

      // console.log('Sign up response:', data);

      if (data?.user) {
        setError('Check your email for the confirmation link');
        setEmail('');
        setPassword('');
      } else {
        throw new Error('No user data returned after signup');
      }
    } catch (err: any) {
      logError('Signup error:', err);
      setError(err.message || 'Failed to sign up');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = async () => {
    setLoading(true);
    setError('');

    try {
      log('Creating guest session...');
      const user = await signInAnonymously();
      
      if (user) {
        log('✅ Guest session created, navigating to AI card flow...');
        
        if (Platform.OS !== 'web') {
          // Small delay for mobile to ensure session is properly set
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Navigate directly to AI card flow step 1
        router.replace('/(tabs)/ai-card-flow');
      } else {
        throw new Error('Failed to create guest session');
      }
    } catch (err: any) {
      logError('Guest mode error:', err);
      setError(err.message || 'Failed to start guest mode');
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded || tosChecking) {
    return <View style={{ flex: 1, backgroundColor: '#121212' }} />;
  }

  return (
    <View style={styles.container}>
      {/* Terms of Service Modal */}
      <Modal
        visible={showTosModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {}}
      >
        <View style={styles.tosContainer}>
          <View style={styles.tosHeader}>
            <Text style={styles.tosTitle}>Terms of Service</Text>
            <Text style={styles.tosSubtitle}>Please read and accept to continue</Text>
          </View>
          
          <ScrollView 
            ref={scrollViewRef}
            style={styles.tosScrollView}
            contentContainerStyle={styles.tosContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <Text style={styles.tosLastUpdated}>Last Updated: January 10, 2026</Text>
            
            <Text style={styles.tosSectionTitle}>Agreement</Text>
            <Text style={styles.tosText}>
              These Terms of Service ("Terms") govern your use of the Subtext Card Game mobile application ("App") provided by Adam Kretz ("we," "us," or "our"). By downloading, installing, or using the App, you agree to be bound by these Terms.
            </Text>
            
            <Text style={styles.tosSectionTitle}>App Purpose</Text>
            <Text style={styles.tosText}>
              Subtext is a creative platform designed for users to enjoy making unique trading cards and learn about themselves and their communication through personal reflection. The App combines game elements with artistic expression to facilitate self-discovery and meaningful social interaction.
            </Text>
            
            <Text style={styles.tosSectionTitle}>Eligibility</Text>
            <Text style={styles.tosText}>
              You must be at least 13 years old to use this App. By using the App, you represent and warrant that you are at least 13 years of age. If you are under 18, you should have your parent or legal guardian review these Terms with you.
            </Text>
            
            <Text style={styles.tosSectionTitle}>Acceptable Use</Text>
            <Text style={styles.tosText}>
              You agree to use the App only for lawful purposes and in accordance with these Terms. Specifically, you may not:{"\n\n"}
              • Create or share content that violates applicable laws{"\n"}
              • Generate images that violate OpenAI's Usage Policies{"\n"}
              • Harass, abuse, or harm other users{"\n"}
              • Attempt unauthorized access to our systems{"\n"}
              • Use the App for commercial purposes without consent
            </Text>
            
            <Text style={styles.tosSectionTitle}>User-Generated Content</Text>
            <Text style={styles.tosText}>
              You retain ownership of all cards, images, and other content you create within the App. We only review User Content when investigating reports of violations. All content must comply with OpenAI's Usage Policies.
            </Text>
            
            <Text style={styles.tosSectionTitle}>NFT Minting</Text>
            <Text style={styles.tosText}>
              NFT minting is entirely optional and free. We pay all gas fees for minting. When you mint a card, the NFT is initially owned by us. You may request transfer by emailing ark44@thegotimer.com - you will pay transfer gas fees (rounded up to nearest dollar).
            </Text>
            
            <Text style={styles.tosSectionTitle}>Privacy</Text>
            <Text style={styles.tosText}>
              Your privacy is important to us. We collect email addresses for account management, store your card creations, and use third-party services (Supabase, OpenAI) to provide the App's features. We do not sell your data.
            </Text>
            
            <Text style={styles.tosSectionTitle}>Disclaimers</Text>
            <Text style={styles.tosText}>
              The App is for entertainment and self-reflection only - not professional advice. AI-generated content may contain inaccuracies. We do not guarantee uninterrupted service.
            </Text>
            
            <Text style={styles.tosSectionTitle}>Limitation of Liability</Text>
            <Text style={styles.tosText}>
              To the maximum extent permitted by law, our total liability shall not exceed $100. We are not liable for indirect, incidental, or consequential damages.
            </Text>
            
            <Text style={styles.tosSectionTitle}>Governing Law</Text>
            <Text style={styles.tosText}>
              These Terms are governed by the laws of Minnesota, USA. Disputes will be resolved through binding arbitration in Minnesota.
            </Text>
            
            <Text style={styles.tosSectionTitle}>Contact</Text>
            <Text style={styles.tosText}>
              Questions? Email us at ark44@thegotimer.com
            </Text>
            
            <TouchableOpacity onPress={openPrivacyPolicy} style={styles.tosLink}>
              <Text style={styles.tosLinkText}>View OpenAI Usage Policies →</Text>
            </TouchableOpacity>
            
            <View style={styles.tosBottomSpacer} />
          </ScrollView>
          
          <View style={styles.tosFooter}>
            {!hasScrolledToBottom && (
              <Text style={styles.tosScrollHint}>↓ Scroll to read all terms</Text>
            )}
            <TouchableOpacity
              style={[
                styles.tosAcceptButton,
                !hasScrolledToBottom && styles.tosAcceptButtonDisabled
              ]}
              onPress={handleAcceptTos}
              disabled={!hasScrolledToBottom}
            >
              <Text style={styles.tosAcceptButtonText}>
                {hasScrolledToBottom ? 'I Accept the Terms of Service' : 'Please read all terms'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.formContainer}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue creating cards</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.signUpButton, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Create Account</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.guestButton, loading && styles.buttonDisabled]}
            onPress={handleGuestMode}
            disabled={loading}
          >
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
  },
  formContainer: {
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  signUpButton: {
    backgroundColor: '#3a3a3a',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 16,
    borderRadius: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a2a2a',
  },
  dividerText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  guestButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  guestButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  // Terms of Service Modal Styles
  tosContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  tosHeader: {
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  tosTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  tosSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#888',
    textAlign: 'center',
  },
  tosScrollView: {
    flex: 1,
  },
  tosContent: {
    padding: 24,
    paddingBottom: 40,
  },
  tosLastUpdated: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  tosSectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  tosText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#ccc',
    lineHeight: 22,
  },
  tosLink: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
  },
  tosLinkText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#6366f1',
  },
  tosBottomSpacer: {
    height: 40,
  },
  tosFooter: {
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    backgroundColor: '#121212',
  },
  tosScrollHint: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
  },
  tosAcceptButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  tosAcceptButtonDisabled: {
    backgroundColor: '#3a3a3a',
    opacity: 0.7,
  },
  tosAcceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
});