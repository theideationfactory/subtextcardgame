import { useState, useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { Platform, View } from 'react-native';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-url-polyfill/auto';
<<<<<<< HEAD
import { log, logError } from '@/utils/logger';
=======
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (loading || !segments.length || isNavigating) return;

    const inAuthGroup = segments[0] === '(tabs)';
<<<<<<< HEAD
    const inPublicGroup = segments[0] === 'welcome' || segments[0] === 'login' || segments[0] === 'drafts' || segments[0] === 'inbox' || segments[0] === 'chat' || segments[0] === 'upgrade-account';
=======
    const inPublicGroup = segments[0] === 'welcome' || segments[0] === 'login' || segments[0] === 'drafts';
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e

    const navigate = async () => {
      setIsNavigating(true);
      try {
        if (!user && inAuthGroup) {
<<<<<<< HEAD
          // No user at all, redirect to login
          log('No user, redirecting to login');
          await router.replace('/login');
        } else if (user && !inAuthGroup && !inPublicGroup) {
          // User exists (authenticated or anonymous), allow access to tabs
          log('User authenticated, redirecting to tabs');
=======
          // console.log('No user, redirecting to login');
          await router.replace('/login');
        } else if (user && !inAuthGroup && !inPublicGroup) {
          // console.log('User authenticated, redirecting to tabs');
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
          await router.replace('/(tabs)');
        }
      } finally {
        setIsNavigating(false);
      }
    };

    navigate();
  }, [user, segments, loading]);
}

function RootLayoutNav() {
  useProtectedRoute();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
<<<<<<< HEAD
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen 
          name="drafts" 
          options={{
            presentation: 'card',
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="inbox" 
          options={{
            presentation: 'card',
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="upgrade-account" 
          options={{
            presentation: 'card',
            headerShown: false,
=======
        <Stack.Screen 
          name="drafts" 
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
          }}
        />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Ensure splash screen is hidden when the app is ready
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
<<<<<<< HEAD
        logError('Error hiding splash screen in RootLayout:', e);
=======
        console.warn('Error hiding splash screen in RootLayout:', e);
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
      }
    };

    // Set up deep linking handler for mobile platforms
    if (Platform.OS !== 'web') {
      const subscription = Linking.addEventListener('url', ({ url }) => {
        if (url) {
          // Handle the deep link URL
<<<<<<< HEAD
          log('Deep link URL:', url);
=======
          console.log('Deep link URL:', url);
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
        }
      });

      // Hide splash screen after a short delay as a fallback
      const timeout = setTimeout(() => {
        hideSplash();
      }, 3000);

      return () => {
        subscription.remove();
        clearTimeout(timeout);
      };
    } else {
      // For web, just hide the splash screen
      hideSplash();
    }
  }, []);

  useEffect(() => {
    // Set ready state after a short delay to ensure everything is initialized
    const timer = setTimeout(() => {
      setReady(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: '#121212' }} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}