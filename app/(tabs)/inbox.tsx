import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, FileText } from 'lucide-react-native';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';

interface SharedDraft {
  id: string;
  name: string;
  last_modified: string;
  color?: string;
  user_id: string; // The ID of the user who shared it
}

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

export default function InboxScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sharedDrafts, setSharedDrafts] = useState<SharedDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      fetchSharedDrafts();
    } else if (!authLoading && !user) {
      setError('Please log in to view your inbox.');
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchSharedDrafts = async () => {
    try {
      setLoading(true);
      setError('');

      if (!user) {
        setError('User not authenticated.');
        setLoading(false);
        return;
      }

      // Query for drafts where the current user's ID is in the shared_with_user_ids array
      const { data, error: fetchError } = await supabase
        .from('spreads')
        .select('id, name, last_modified, color, user_id')
        .contains('shared_with_user_ids', [user.id])
        .order('last_modified', { ascending: false });

      if (fetchError) throw fetchError;

      setSharedDrafts(data || []);
    } catch (err) {
      console.error('Error fetching shared drafts:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load shared drafts';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    };
    return new Date(date).toLocaleString(undefined, options);
  };

  const renderSharedDraft = ({ item }: { item: SharedDraft }) => (
    <TouchableOpacity 
      style={styles.draftItem}
      onPress={() => router.replace({
        pathname: '/(tabs)/spread',
        params: { draftId: item.id } // Use draftId to open the spread
      })}
    >
      <View style={styles.draftInfo}>
        <View style={styles.draftHeader}>
          <FileText size={20} color={item.color} style={styles.draftIcon} />
          <Text style={styles.draftName}>{item.name}</Text>
        </View>
        <Text style={styles.draftDate}>
          Shared: {formatDate(item.last_modified)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Inbox</Text>
      </View>
      {loading ? (
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : error ? (
        <View style={styles.content}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : sharedDrafts.length === 0 ? (
        <View style={styles.content}>
          <Text style={styles.subtitle}>No shared drafts yet.</Text>
          <Text style={styles.emptySubtext}>Shared spreads will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={sharedDrafts}
          renderItem={renderSharedDraft}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 16,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  draftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  draftInfo: {
    flex: 1,
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  draftIcon: {
    marginRight: 8,
  },
  draftName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  draftDate: {
    color: '#666',
    fontSize: 14,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
  },
});
