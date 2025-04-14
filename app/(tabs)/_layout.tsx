import { Tabs } from 'expo-router';
import { Plus, Car as Cards, Settings, LayoutGrid as Layout, Users } from 'lucide-react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Platform } from 'react-native';
import { SafeAreaWrapper } from '@/components/SafeAreaWrapper';

export default function TabLayout() {
  const { fetchCards } = useAuth();

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

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
            height: Platform.OS === 'ios' ? 88 : 60,
            paddingBottom: Platform.OS === 'ios' ? 28 : 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#fff',
          tabBarInactiveTintColor: '#888',
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Collection',
            tabBarIcon: ({ size, color }) => <Cards size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: 'Create Card',
            tabBarIcon: ({ size, color }) => <Plus size={size} color={color} />,
            listeners: {
              tabPress: (e) => {
                e.preventDefault();
                router.push({
                  pathname: '/create',
                  params: {}
                });
              },
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
      </Tabs>
    </SafeAreaWrapper>
  );
}