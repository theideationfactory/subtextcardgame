import { Tabs } from 'expo-router';
<<<<<<< HEAD
import { Plus, Layers, Settings, LayoutGrid as Layout, Users } from 'lucide-react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, Dimensions } from 'react-native';
import { SafeAreaWrapper } from '@/components/SafeAreaWrapper';
import { TouchableOpacity } from 'react-native';
import { useFonts, Cinzel_400Regular } from '@expo-google-fonts/cinzel';
=======
import { Plus, Car as Cards, Settings, LayoutGrid as Layout, Users } from 'lucide-react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { SafeAreaWrapper } from '@/components/SafeAreaWrapper';
import { TouchableOpacity } from 'react-native';
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e

export default function TabLayout() {
  const { fetchCards } = useAuth();
  const insets = useSafeAreaInsets();
<<<<<<< HEAD
  const [isLandscape, setIsLandscape] = useState(false);

  const [fontsLoaded] = useFonts({
    'Cinzel-Regular': Cinzel_400Regular,
  });
=======
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

<<<<<<< HEAD
  useEffect(() => {
    const updateOrientation = () => {
      const { width, height } = Dimensions.get('window');
      setIsLandscape(width > height);
    };

    // Set initial orientation
    updateOrientation();

    // Listen for orientation changes
    const subscription = Dimensions.addEventListener('change', updateOrientation);

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <SafeAreaWrapper skipBottomInset backgroundColor="#090909">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: isLandscape ? {
            display: 'none',
          } : {
            backgroundColor: '#1a1a1a',
            borderTopWidth: 0,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            height: Platform.OS === 'ios' ? 80 : 70,
            paddingBottom: 12,
            paddingTop: 8,
            borderRadius: 25,
            marginHorizontal: 20,
            bottom: 20,
            position: 'absolute',
=======
  return (
    <SafeAreaWrapper>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1a1a1a',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            height: Platform.OS === 'ios' ? 80 : 70,
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 12,
            paddingTop: 8,
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
          },
          tabBarLabelStyle: {
            fontSize: 12,
            marginBottom: 4,
<<<<<<< HEAD
            fontFamily: fontsLoaded ? 'Cinzel-Regular' : 'Inter-Regular',
            letterSpacing: 1,
=======
            fontFamily: 'Inter-Regular',
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
          },
          tabBarItemStyle: {
            paddingVertical: 4,
          },
          tabBarActiveTintColor: '#fff',
          tabBarInactiveTintColor: '#888',
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Cards',
<<<<<<< HEAD
            tabBarIcon: ({ size, color }) => <Layers size={size} color={color} />,
=======
            tabBarIcon: ({ size, color }) => <Cards size={size} color={color} />,
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: 'Create',
            tabBarIcon: ({ size, color }) => <Plus size={size} color={color} />,
            tabBarButton: (props) => {
              // Create a custom button that doesn't pass through all props
              return (
                <TouchableOpacity 
                  style={props.style}
                  activeOpacity={0.6}
                  onPress={() => {
                    router.push({
                      pathname: '/create',
                      params: {}
                    });
                  }}
                >
                  {props.children}
                </TouchableOpacity>
              );
            },
          }}
        />
        <Tabs.Screen
          name="spread"
          options={{
            title: 'Spread',
            tabBarIcon: ({ size, color }) => <Layout size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Friends',
            tabBarIcon: ({ size, color }) => <Users size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ size, color }) => <Settings size={size} color={color} />,
          }}
        />
<<<<<<< HEAD
        <Tabs.Screen
          name="ai-card-flow"
          options={{
            href: null, // This screen is not a tab itself
            headerShown: false, // Hide header for this screen
          }}
        />
        <Tabs.Screen
          name="ai-card-flow-step2"
          options={{
            href: null, // This screen is not a tab itself
            headerShown: false, // Hide header for this screen
          }}
        />
        <Tabs.Screen
          name="ai-card-flow-step3"
          options={{
            href: null, // This screen is not a tab itself
            headerShown: false, // Hide header for this screen
          }}
        />
        <Tabs.Screen
          name="ai-card-flow-step4"
          options={{
            href: null, // This screen is not a tab itself
            headerShown: false, // Hide header for this screen
          }}
        />
        <Tabs.Screen
          name="ai-card-flow-review"
          options={{
            href: null, // This screen is not a tab itself
            headerShown: false, // Hide header for this screen
          }}
        />
        <Tabs.Screen
          name="card-creation-new"
          options={{
            href: null, // This screen is not a tab itself
            headerShown: false, // Hide header for this screen
          }}
        />
        <Tabs.Screen
          name="deck-creation"
          options={{
            href: null, // This screen is not a tab itself
            headerShown: false, // Hide header for this screen
          }}
        />
        <Tabs.Screen
          name="deck-detail"
          options={{
            href: null, // This screen is not a tab itself
            headerShown: false, // Hide header for this screen
          }}
        />
        <Tabs.Screen
          name="custom-spread-builder"
          options={{
            href: null, // This screen is not a tab itself
            headerShown: false, // Hide header for this screen
          }}
        />
        <Tabs.Screen
          name="card-inbox"
          options={{
            href: null, // This screen is not a tab itself
            headerShown: false, // Hide header for this screen
          }}
        />
        <Tabs.Screen
          name="custom-generation-builder"
          options={{
            href: null, // This screen is not a tab itself
            headerShown: false, // Hide header for this screen
          }}
        />
=======
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
      </Tabs>
    </SafeAreaWrapper>
  );
}