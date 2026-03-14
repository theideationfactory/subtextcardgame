import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Inbox, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { log, logError } from '@/utils/logger';

interface GenerationJob {
  id: number;
  user_id: string;
  card_data: {
    name: string;
    description?: string;
    imageDescription?: string;
    type?: string;
    role?: string;
    context?: string;
    borderStyle?: string;
    borderColor?: string;
    format?: string;
    isPremium?: boolean;
    generationType?: string;
    customGenerationTypeId?: string | null;
  };
  status: 'queued' | 'processing' | 'completed' | 'failed';
  image_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface CardDraft {
  id: string;
  name: string;
  description?: string;
  type: string;
  role?: string;
  context?: string;
  image_url?: string;
  format: string;
  background_gradient?: string;
  border_style: string;
  border_color: string;
  visibility: string[];
  is_uploaded_image: boolean;
  created_at: string;
  last_modified: string;
}

export default function CardInboxScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [cardDrafts, setCardDrafts] = useState<CardDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'generation' | 'drafts'>('generation');

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  // Fetch generation jobs from database
  const fetchGenerationJobs = useCallback(async (showRefreshing = false) => {
    if (!user) return;
    
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const { data, error } = await supabase
        .from('image_generation_queue')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        logError('Error fetching generation jobs:', error);
        return;
      }
      
      setGenerationJobs(data || []);
    } catch (err) {
      logError('Error fetching generation jobs:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  // Fetch card drafts from database
  const fetchCardDrafts = useCallback(async () => {
    if (!user) return;
    
    log('Fetching card drafts for user:', user.id);
    
    try {
      const { data, error } = await supabase
        .from('card_drafts')
        .select('*')
        .eq('user_id', user.id)
        .eq('draft_type', 'card')
        .order('last_modified', { ascending: false });
      
      if (error) {
        logError('Error fetching card drafts:', error);
        return;
      }
      
      log('Card drafts fetched:', data?.length, 'drafts');
      if (data && data.length > 0) {
        log('First draft:', data[0].id, data[0].name);
      }
      
      setCardDrafts(data || []);
    } catch (err) {
      logError('Error fetching card drafts:', err);
    }
  }, [user]);

  // Refresh jobs when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchGenerationJobs();
      fetchCardDrafts();
      
      // Set up polling for pending jobs
      const intervalId = setInterval(() => {
        fetchGenerationJobs();
      }, 5000);
      
      return () => clearInterval(intervalId);
    }, [fetchGenerationJobs, fetchCardDrafts])
  );

  // Handle tapping on a card draft
  const handleDraftPress = (draft: CardDraft) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Navigate to card creation with ONLY draftId
    // The card creation screen will load all data from database
    router.push({
      pathname: '/(tabs)/card-creation-new',
      params: {
        draftId: draft.id,
        returnTo: 'card-inbox',
      },
    });
  };

  // Delete a card draft
  const handleDeleteDraft = async (draftId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Delete Draft',
      'Are you sure you want to delete this card draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('card_drafts')
                .delete()
                .eq('id', draftId);
              
              if (error) {
                logError('Error deleting draft:', error);
                return;
              }
              
              setCardDrafts(prev => prev.filter(d => d.id !== draftId));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              logError('Error deleting draft:', err);
            }
          },
        },
      ]
    );
  };

  // Handle tapping on a generation job
  const handleJobPress = async (job: GenerationJob) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (job.status === 'completed') {
      // Card was created automatically - navigate to Cards tab
      // Delete the job from the queue since the card is already created
      try {
        await supabase
          .from('image_generation_queue')
          .delete()
          .eq('id', job.id);
        
        setGenerationJobs(prev => prev.filter(j => j.id !== job.id));
      } catch (err) {
        logError('Error deleting completed job:', err);
      }
      
      // Navigate to Cards tab
      router.push('/(tabs)');
    } else if (job.status === 'failed') {
      // Failed job - allow user to retry by going to card creation
      router.push({
        pathname: '/(tabs)/card-creation-new',
        params: {
          name: job.card_data.name || '',
          description: job.card_data.description || '',
          image_description: job.card_data.imageDescription || '',
          type: job.card_data.type || '',
          role: job.card_data.role || '',
          context: job.card_data.context || '',
          border_style: job.card_data.borderStyle || '',
          border_color: job.card_data.borderColor || '',
          generation_type: job.card_data.generationType || '',
          custom_generation_type_id: job.card_data.customGenerationTypeId || '',
        },
      });
    }
    // For queued/processing jobs, do nothing (just show status)
  };

  // Delete a generation job
  const handleDeleteJob = async (jobId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Delete Draft',
      'Are you sure you want to delete this card draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('image_generation_queue')
                .delete()
                .eq('id', jobId);
              
              if (error) {
                logError('Error deleting job:', error);
                return;
              }
              
              setGenerationJobs(prev => prev.filter(job => job.id !== jobId));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              logError('Error deleting job:', err);
            }
          },
        },
      ]
    );
  };

  // Clear all completed/failed jobs
  const handleClearCompleted = async () => {
    const completedJobs = generationJobs.filter(job => job.status === 'completed' || job.status === 'failed');
    if (completedJobs.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Clear Completed',
      `Delete ${completedJobs.length} completed/failed drafts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const ids = completedJobs.map(job => job.id);
              const { error } = await supabase
                .from('image_generation_queue')
                .delete()
                .in('id', ids);
              
              if (error) {
                logError('Error clearing jobs:', error);
                return;
              }
              
              setGenerationJobs(prev => prev.filter(job => job.status !== 'completed' && job.status !== 'failed'));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              logError('Error clearing jobs:', err);
            }
          },
        },
      ]
    );
  };

  // Get status icon and color
  const getStatusInfo = (status: GenerationJob['status']) => {
    switch (status) {
      case 'queued':
        return { icon: Clock, color: '#f59e0b', label: 'Queued', description: 'Waiting to generate...' };
      case 'processing':
        return { icon: Clock, color: '#3b82f6', label: 'Processing', description: 'Generating image...' };
      case 'completed':
        return { icon: CheckCircle, color: '#10b981', label: 'Created', description: 'Tap to view in Cards' };
      case 'failed':
        return { icon: XCircle, color: '#ef4444', label: 'Failed', description: 'Tap to retry' };
      default:
        return { icon: Clock, color: '#666', label: 'Unknown', description: '' };
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/create');
  };

  if (!fontsLoaded) {
    return null;
  }

  // Count jobs by status
  const pendingCount = generationJobs.filter(j => j.status === 'queued' || j.status === 'processing').length;
  const readyCount = generationJobs.filter(j => j.status === 'completed').length;
  const failedCount = generationJobs.filter(j => j.status === 'failed').length;

  const renderJob = ({ item: job }: { item: GenerationJob }) => {
    const statusInfo = getStatusInfo(job.status);
    const StatusIcon = statusInfo.icon;
    
    return (
      <Pressable
        style={[
          styles.jobCard,
          job.status === 'completed' && styles.jobCardCompleted,
          job.status === 'failed' && styles.jobCardFailed,
        ]}
        onPress={() => handleJobPress(job)}
      >
        <View style={styles.jobContent}>
          <View style={styles.jobIconContainer}>
            {job.status === 'processing' ? (
              <ActivityIndicator size={24} color={statusInfo.color} />
            ) : (
              <StatusIcon size={24} color={statusInfo.color} />
            )}
          </View>
          
          <View style={styles.jobInfo}>
            <Text style={styles.jobName} numberOfLines={1}>
              {job.card_data.name || 'Untitled Card'}
            </Text>
            <Text style={styles.jobDescription} numberOfLines={1}>
              {statusInfo.description}
            </Text>
            <View style={styles.jobMeta}>
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                  {statusInfo.label}
                </Text>
              </View>
              <Text style={styles.jobTime}>{formatTimeAgo(job.created_at)}</Text>
            </View>
            {job.error_message && (
              <Text style={styles.errorText} numberOfLines={2}>
                {job.error_message}
              </Text>
            )}
          </View>
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteJob(job.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={18} color="#666" />
          </TouchableOpacity>
        </View>
      </Pressable>
    );
  };

  const renderDraft = ({ item: draft }: { item: CardDraft }) => {
    return (
      <Pressable
        style={styles.jobCard}
        onPress={() => handleDraftPress(draft)}
      >
        <View style={styles.jobContent}>
          <View style={[styles.jobIconContainer, { backgroundColor: '#6366f120' }]}>
            <Inbox size={24} color="#6366f1" />
          </View>
          
          <View style={styles.jobInfo}>
            <Text style={styles.jobName} numberOfLines={1}>
              {draft.name || 'Untitled Draft'}
            </Text>
            <Text style={styles.jobDescription} numberOfLines={1}>
              {draft.type} • {draft.role || 'No role'} • {draft.context || 'No context'}
            </Text>
            <View style={styles.jobMeta}>
              <View style={[styles.statusBadge, { backgroundColor: '#6366f120' }]}>
                <Text style={[styles.statusText, { color: '#6366f1' }]}>Draft</Text>
              </View>
              <Text style={styles.jobTime}>{formatTimeAgo(draft.last_modified)}</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteDraft(draft.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={18} color="#666" />
          </TouchableOpacity>
        </View>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Inbox size={64} color="#444" />
      <Text style={styles.emptyTitle}>
        {activeTab === 'generation' ? 'No Generation Jobs' : 'No Card Drafts'}
      </Text>
      <Text style={styles.emptyDescription}>
        {activeTab === 'generation' 
          ? 'When you generate card images, they\'ll appear here so you can complete them later.'
          : 'When you save a card draft, it will appear here so you can continue working on it later.'}
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push('/(tabs)/card-creation-new')}
      >
        <Text style={styles.createButtonText}>Create a Card</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Card Inbox</Text>
        {activeTab === 'generation' && (readyCount > 0 || failedCount > 0) && (
          <TouchableOpacity onPress={handleClearCompleted} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
        {(activeTab === 'drafts' || (readyCount === 0 && failedCount === 0)) && <View style={styles.placeholder} />}
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'generation' && styles.activeTab]}
          onPress={() => setActiveTab('generation')}
        >
          <Text style={[styles.tabText, activeTab === 'generation' && styles.activeTabText]}>
            Generation Queue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'drafts' && styles.activeTab]}
          onPress={() => setActiveTab('drafts')}
        >
          <Text style={[styles.tabText, activeTab === 'drafts' && styles.activeTabText]}>
            Saved Drafts {cardDrafts.length > 0 && `(${cardDrafts.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Bar - only show for generation tab */}
      {activeTab === 'generation' && generationJobs.length > 0 && (
        <View style={styles.statsBar}>
          {pendingCount > 0 && (
            <View style={styles.statItem}>
              <Clock size={14} color="#f59e0b" />
              <Text style={[styles.statText, { color: '#f59e0b' }]}>{pendingCount} pending</Text>
            </View>
          )}
          {readyCount > 0 && (
            <View style={styles.statItem}>
              <CheckCircle size={14} color="#10b981" />
              <Text style={[styles.statText, { color: '#10b981' }]}>{readyCount} ready</Text>
            </View>
          )}
          {failedCount > 0 && (
            <View style={styles.statItem}>
              <XCircle size={14} color="#ef4444" />
              <Text style={[styles.statText, { color: '#ef4444' }]}>{failedCount} failed</Text>
            </View>
          )}
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : activeTab === 'generation' ? (
        <FlatList
          data={generationJobs}
          renderItem={renderJob}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchGenerationJobs(true)}
              tintColor="#6366f1"
            />
          }
        />
      ) : (
        <FlatList
          data={cardDrafts}
          renderItem={renderDraft}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                fetchCardDrafts().finally(() => setIsRefreshing(false));
              }}
              tintColor="#6366f1"
            />
          }
        />
      )}
    </SafeAreaView>
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
    paddingVertical: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#fff',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: '#ef4444',
  },
  placeholder: {
    width: 40,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  jobCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  jobCardCompleted: {
    borderColor: '#10b98150',
    backgroundColor: '#10b98108',
  },
  jobCardFailed: {
    borderColor: '#ef444450',
    backgroundColor: '#ef444408',
  },
  jobContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  jobIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  jobInfo: {
    flex: 1,
  },
  jobName: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: '#fff',
    marginBottom: 4,
  },
  jobDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
  },
  jobTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#666',
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#ef4444',
    marginTop: 8,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#6366f1',
  },
  tabText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#888',
  },
  activeTabText: {
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
});
