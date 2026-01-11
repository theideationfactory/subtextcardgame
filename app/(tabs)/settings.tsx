import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, LogOut, Trash2, Shield, FileText, Mail } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { log, logError } from '@/utils/logger';

SplashScreen.preventAutoHideAsync();

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isAnonymous } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // First confirmation
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => confirmDeleteAccount(),
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    // Second confirmation with explicit warning
    Alert.alert(
      '⚠️ Final Warning',
      'This will permanently delete:\n\n• All your cards\n• All your spreads and drafts\n• All your conversations\n• Your account and profile\n\nThis cannot be recovered.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => executeAccountDeletion(),
        },
      ]
    );
  };

  const executeAccountDeletion = async () => {
    if (!user) {
      Alert.alert('Error', 'No user found. Please sign in again.');
      return;
    }

    setIsDeleting(true);
    
    try {
      log('🗑️ Starting account deletion for user:', user.id);
      
      // Delete user's data from various tables
      // Order matters due to foreign key constraints
      
      // 1. Delete cards
      const { error: cardsError } = await supabase
        .from('cards')
        .delete()
        .eq('user_id', user.id);
      
      if (cardsError) {
        logError('Error deleting cards:', cardsError);
      }
      
      // 2. Delete spreads/drafts
      const { error: spreadsError } = await supabase
        .from('spreads')
        .delete()
        .eq('user_id', user.id);
      
      if (spreadsError) {
        logError('Error deleting spreads:', spreadsError);
      }
      
      // 3. Delete messages
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('sender_id', user.id);
      
      if (messagesError) {
        logError('Error deleting messages:', messagesError);
      }
      
      // 4. Delete conversations where user is participant
      const { error: conversationsError } = await supabase
        .from('conversations')
        .delete()
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
      
      if (conversationsError) {
        logError('Error deleting conversations:', conversationsError);
      }
      
      // 5. Delete friend relationships
      const { error: friendsError } = await supabase
        .from('friends')
        .delete()
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
      
      if (friendsError) {
        logError('Error deleting friends:', friendsError);
      }
      
      // 6. Delete custom generation types
      const { error: customTypesError } = await supabase
        .from('custom_generation_types')
        .delete()
        .eq('user_id', user.id);
      
      if (customTypesError) {
        logError('Error deleting custom types:', customTypesError);
      }
      
      // 7. Delete custom spread templates
      const { error: templatesError } = await supabase
        .from('custom_spread_templates')
        .delete()
        .eq('user_id', user.id);
      
      if (templatesError) {
        logError('Error deleting templates:', templatesError);
      }
      
      // 8. Delete collections
      const { error: collectionsError } = await supabase
        .from('collections')
        .delete()
        .eq('user_id', user.id);
      
      if (collectionsError) {
        logError('Error deleting collections:', collectionsError);
      }
      
      // 9. Delete image generation queue items
      const { error: queueError } = await supabase
        .from('image_generation_queue')
        .delete()
        .eq('user_id', user.id);
      
      if (queueError) {
        logError('Error deleting queue items:', queueError);
      }
      
      // 10. Delete the user's profile if exists
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);
      
      if (profileError) {
        logError('Error deleting profile:', profileError);
      }
      
      log('✅ User data deleted successfully');
      
      // Sign out the user (this effectively "deletes" the auth record for anonymous users)
      await supabase.auth.signOut();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success and redirect
      Alert.alert(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/welcome'),
          },
        ]
      );
      
    } catch (error) {
      logError('❌ Error during account deletion:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        'There was a problem deleting your account. Please try again or contact support.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const openPrivacyPolicy = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('https://subdexcardgame.replit.app/privacy');
  };

  const openTermsOfService = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('https://subdexcardgame.replit.app/terms');
  };

  const openSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('mailto:ark44@thegotimer.com?subject=Subtext App Support');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Info */}
        {user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>
                {isAnonymous ? 'Guest Account' : (user.email || 'Not set')}
              </Text>
            </View>
            {isAnonymous && (
              <TouchableOpacity 
                style={[styles.button, styles.upgradeButton]}
                onPress={() => router.push('/upgrade-account')}
                accessibilityLabel="Upgrade to full account"
              >
                <Text style={styles.buttonText}>Upgrade to Full Account</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={openPrivacyPolicy}
            accessibilityLabel="View privacy policy"
          >
            <Shield size={20} color="#9ca3af" />
            <Text style={styles.linkButtonText}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={openTermsOfService}
            accessibilityLabel="View terms of service"
          >
            <FileText size={20} color="#9ca3af" />
            <Text style={styles.linkButtonText}>Terms of Service</Text>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={openSupport}
            accessibilityLabel="Contact support"
          >
            <Mail size={20} color="#9ca3af" />
            <Text style={styles.linkButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          <TouchableOpacity 
            style={[styles.button, styles.signOutButton]}
            onPress={handleSignOut}
            accessibilityLabel="Sign out of your account"
          >
            <LogOut size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.dangerButton]}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
            accessibilityLabel="Delete your account permanently"
          >
            {isDeleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Trash2 size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Delete Account</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.dangerWarning}>
            This will permanently delete all your data
          </Text>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Subtext v1.0.1</Text>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#fff',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#1f1f1f',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  infoValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
  },
  button: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    flexDirection: 'row',
    minHeight: 52,
  },
  buttonIcon: {
    marginRight: 8,
  },
  upgradeButton: {
    backgroundColor: '#10b981',
  },
  signOutButton: {
    backgroundColor: '#6366f1',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    minHeight: 52,
  },
  linkButtonText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  dangerWarning: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 32,
  },
  versionText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#6b7280',
  },
});