import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Button } from 'react-native';
import { Stack, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Error boundary component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    console.error('Error in InboxScreen:', error);
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Error in InboxScreen:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Something went wrong in the Inbox screen.</Text>
          <Button 
            title="Try Again"
            onPress={() => this.setState({ hasError: false })}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

export default function InboxScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  // Log when the component mounts and unmounts
  useEffect(() => {
    console.log('InboxScreen: Component mounted');
    
    // Log navigation state when it changes
    const unsubscribe = navigation.addListener('state', (e) => {
      console.log('InboxScreen: Navigation state changed', e.data?.state);
    });
    
    return () => {
      console.log('InboxScreen: Component unmounting');
      unsubscribe();
    };
  }, [navigation]);

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inbox</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.placeholderText}>
            Inbox is coming soon.
          </Text>
          <Text style={styles.subText}>
            You will soon be able to send and receive spreads with other users.
          </Text>
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Dark theme background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    color: '#fff',
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  subText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
});
