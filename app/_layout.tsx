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

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (loading || !segments.length || isNavigating) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inPublicGroup = segments[0] === 'welcome' || segments[0] === 'login' || segments[0] === 'drafts' || segments[0] === 'inbox';

    const navigate = async () => {
      setIsNavigating(true);
      try {
        if (!user && inAuthGroup) {
          // console.log('No user, redirecting to login');
          await router.replace('/login');
        } else if (user && !inAuthGroup && !inPublicGroup) {
          // console.log('User authenticated, redirecting to tabs');
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
        <Stack.Screen 
          name="drafts" 
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
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
        console.warn('Error hiding splash screen in RootLayout:', e);
      }
    };

    // Set up deep linking handler for mobile platforms
    if (Platform.OS !== 'web') {
      const subscription = Linking.addEventListener('url', ({ url }) => {
        if (url) {
          // Handle the deep link URL
          console.log('Deep link URL:', url);
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