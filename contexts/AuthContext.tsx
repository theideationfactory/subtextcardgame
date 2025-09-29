import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session, PostgrestError } from '@supabase/supabase-js';

type Card = {
  id: string;
  name: string;
  description: string;
  type: string;
  role: string;
  context: string;
  image_url: string;
  frame_width: number;
  frame_color: string;
  name_color: string;
  type_color: string;
  description_color: string;
  context_color: string;
  user_id: string;
  collection_id?: string;
  shared_with_user_ids?: string[];
  is_shared_with_friends?: boolean;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  cards: Card[];
  refreshSession: () => Promise<Session | null | undefined>;
  fetchCards: (page?: number, limit?: number, useCache?: boolean, scope?: string) => Promise<Card[]>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  cards: [],
  refreshSession: async () => null,
  fetchCards: async () => [],
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);

  const refreshSession = async () => {
    try {
      console.log('🔄 Refreshing session...');
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ Session refresh error:', error.message);
        return null;
      }
      
      if (session?.user) {
        console.log('✅ Session refreshed successfully for user:', session.user.email);
        setUser(session.user);
        return session;
      } else {
        console.log('⚠️ No session returned after refresh');
        return null;
      }
    } catch (error) {
      console.error('❌ Unexpected error during session refresh:', error);
      return null;
    }
  };

  const fetchCards = async (page = 0, limit = 20, useCache = true, scope = 'personal'): Promise<Card[]> => {
    try {
      setLoading(true);
      
      // Early return if no user for scopes that require authentication
      if (!user?.id) {
        console.log('No authenticated user, returning empty cards array');
        setCards([]);
        return [];
      }
      
      // Return cached cards if available and cache is enabled
      if (useCache && !scope && cards.length > 0 && page === 0) {
        return cards; // CACHED RESULT!
      }
      
      // Rest of fetchCards implementation...
      let query = supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      // Apply scope filtering with proper null checks
      if (scope === 'personal') {
        query = query.eq('user_id', user.id);
      } else if (scope === 'friends') {
        // Friend filtering logic...
        const { data: friends } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .eq('status', 'accepted');

        if (friends) {
          const friendIds = friends.flatMap(f => [f.sender_id, f.receiver_id]).filter(id => id !== user.id);
          query = query.in('user_id', friendIds).eq('is_shared_with_friends', true);
        }
      } else if (scope === 'public') {
        query = query.eq('is_public', true).neq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching cards:', error);
        return []; // Return empty array on error
      }

      const fetchedCards = data || [];
      setCards(fetchedCards);
      return fetchedCards;
    } catch (error) {
      console.error('Unexpected error fetching cards:', error);
      return []; // Return empty array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial session check
    const initAuth = async () => {
      try {
        console.log('🔄 Initializing authentication...');
        
        // Get current session from storage
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
          setLoading(false);
          return;
        }
        
        if (session?.user) {
          console.log('✅ Found existing session for user:', session.user.email);
          setUser(session.user);
          
          // Check if session is still valid by making a test query
          try {
            await supabase.from('users').select('id').limit(1);
            console.log('✅ Session is valid, fetching cards...');
            await fetchCards();
          } catch (sessionError) {
            console.log('⚠️ Session expired, attempting refresh...');
            // Session expired, try to refresh
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError || !refreshData.session) {
              console.log('❌ Session refresh failed, user needs to sign in again');
              setUser(null);
            } else {
              console.log('✅ Session refreshed successfully');
              setUser(refreshData.session.user);
              await fetchCards();
            }
          }
        } else {
          console.log('ℹ️ No existing session found');
          setUser(null);
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email || 'no user');
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in:', session.user.email);
        setUser(session.user);
        await fetchCards();
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        setUser(null);
        setCards([]);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('🔄 Token refreshed for user:', session.user.email);
        setUser(session.user);
        // Don't refetch cards on token refresh, just update user state
      } else if (event === 'USER_UPDATED' && session?.user) {
        console.log('👤 User updated:', session.user.email);
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    loading,
    cards,
    refreshSession,
    fetchCards,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
