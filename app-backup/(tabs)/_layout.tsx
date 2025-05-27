import { Tabs } from 'expo-router';
import { Plus, Car as Cards, Settings, LayoutGrid as Layout, Users } from 'lucide-react-native';
import { router } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
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
              router.push('/create');
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
  );
}