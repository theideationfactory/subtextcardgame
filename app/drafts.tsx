import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { useRouter } from 'expo-router';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, FileText, Trash2 } from 'lucide-react-native';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DraftsScreen() {
  const router = useRouter();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from('spreads')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_draft', true)
        .order('last_modified', { ascending: false });

      if (fetchError) throw fetchError;
      setDrafts(data || []);
    } catch (err) {
      console.error('Error fetching drafts:', err);
      setError('Failed to load drafts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (draftId: string) => {
    try {
      setDeleting(draftId);
      const { error: deleteError } = await supabase
        .from('spreads')
        .delete()
        .eq('id', draftId);

      if (deleteError) throw deleteError;
      setDrafts(drafts.filter(draft => draft.id !== draftId));
    } catch (err) {
      console.error('Error deleting draft:', err);
      setError('Failed to delete draft');
    } finally {
      setDeleting(null);
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

  const renderDraft = ({ item }) => (
    <TouchableOpacity 
      style={styles.draftItem}
      onPress={() => router.push({
        pathname: '/(tabs)/spread',
        params: { draftId: item.id }
      })}
    >
      <View style={styles.draftInfo}>
        <View style={styles.draftHeader}>
          <FileText size={20} color={item.color} style={styles.draftIcon} />
          <Text style={styles.draftName}>{item.name}</Text>
        </View>
        <Text style={styles.draftDate}>
          Last modified: {formatDate(item.last_modified)}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.deleteButton,
          deleting === item.id && styles.deleteButtonDisabled
        ]}
        onPress={() => handleDelete(item.id)}
        disabled={deleting === item.id}
      >
        {deleting === item.id ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Trash2 size={20} color="#ff4444" />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Spread Drafts</Text>
      </View>
      
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : drafts.length === 0 ? (
        <View style={styles.centerContent}>
          <FileText size={48} color="#666" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>No drafts yet</Text>
          <Text style={styles.emptySubtext}>
            Your saved spread drafts will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          renderItem={renderDraft}
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
    backgroundColor: '#121212',
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
    fontFamily: 'Inter-Bold',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    fontFamily: 'Inter-Bold',
  },
  draftDate: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
});