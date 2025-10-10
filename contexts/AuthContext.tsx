import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
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
  isAnonymous: boolean;
  refreshSession: () => Promise<Session | null | undefined>;
  fetchCards: (page?: number, limit?: number, useCache?: boolean, scope?: string) => Promise<Card[]>;
  signInAnonymously: () => Promise<User | null>;
  upgradeAnonymousAccount: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  cards: [],
  isAnonymous: false,
  refreshSession: async () => null,
  fetchCards: async () => [],
  signInAnonymously: async () => null,
  upgradeAnonymousAccount: async () => ({ success: false }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const signInAnonymously = useCallback(async () => {
    try {
      console.log('👤 Creating anonymous session...');
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        console.error('❌ Anonymous sign-in error:', error.message);
        return null;
      }

      if (data?.user) {
        console.log('✅ Anonymous user created:', data.user.id);
        setUser(data.user);
        setIsAnonymous(true);
        return data.user;
      }

      return null;
    } catch (e) {
      console.error('❌ Unexpected error during anonymous sign-in:', e);
      return null;
    }
  }, []);

  const upgradeAnonymousAccount = useCallback(async (email: string, password: string) => {
    try {
      if (!isAnonymous || !user) {
        return { success: false, error: 'Not an anonymous user' };
      }

      console.log('⬆️ Upgrading anonymous account to full account...');
      
      // Update user with both email and password in one call
      // This works when manual linking is enabled in Supabase
      const { data, error } = await supabase.auth.updateUser({
        email,
        password,
      });

      if (error) {
        console.error('❌ Account upgrade error:', error.message);
        
        // Provide helpful error messages
        if (error.message.includes('already registered')) {
          return { success: false, error: 'This email is already registered. Please sign in instead.' };
        }
        if (error.message.includes('manual linking')) {
          return { success: false, error: 'Manual linking must be enabled in Supabase Dashboard. Go to Authentication → Settings → Enable Manual Linking.' };
        }
        
        return { success: false, error: error.message };
      }

      if (data?.user) {
        console.log('✅ Account upgraded successfully:', data.user.email);
        setUser(data.user);
        setIsAnonymous(false);
        return { success: true };
      }

      return { success: false, error: 'Unknown error' };
    } catch (e) {
      console.error('❌ Unexpected error during account upgrade:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }, [isAnonymous, user]);

  const refreshSession = useCallback(async () => {
    try {
      console.log('🔄 Refreshing session...');
      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('❌ Session refresh error:', error.message);
        return null;
      }

      if (session?.user) {
        console.log('✅ Session refreshed successfully for user:', session.user.email || 'anonymous');
        setUser(session.user);
        setIsAnonymous(session.user.is_anonymous || false);
        return session;
      }

      console.log('⚠️ No session returned after refresh');
      return null;
    } catch (e) {
      console.error('❌ Unexpected error during session refresh:', e);
      return null;
    }
  }, []);

  const fetchCards = useCallback(
    async (page = 0, limit = 20, useCache = true, scope = 'personal'): Promise<Card[]> => {
      try {
        // Early return if no user for scopes that require authentication
        const uid = user?.id;
        if (!uid) {
          console.log('No authenticated user, returning empty cards array');
          setCards([]);
          return [];
        }

        // Base query
        let query = supabase
          .from('cards')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * limit, (page + 1) * limit - 1);

        // Apply scope filtering with proper null checks
        if (scope === 'personal') {
          query = query.eq('user_id', uid);
        } else if (scope === 'friends') {
          const { data: friends } = await supabase
            .from('friend_requests')
            .select('sender_id, receiver_id')
            .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
            .eq('status', 'accepted');

          if (friends) {
            const friendIds = friends
              .flatMap(f => [f.sender_id, f.receiver_id])
              .filter(id => id !== uid);
            query = query.in('user_id', friendIds).eq('is_shared_with_friends', true);
          }
        } else if (scope === 'public') {
          query = query.eq('is_public', true).neq('user_id', uid);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching cards:', error);
          return [];
        }

        const fetchedCards = (data || []) as Card[];
        setCards(prev => (JSON.stringify(prev) === JSON.stringify(fetchedCards) ? prev : fetchedCards));
        return fetchedCards;
      } catch (e) {
        console.error('Unexpected error fetching cards:', e);
        return [];
      }
    },
    [user?.id]
  );

  useEffect(() => {
    let mounted = true;
    
    // Initial session check
    const initAuth = async () => {
      try {
        console.log('🔄 Initializing authentication...');
        
        // Get current session from storage
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('❌ Error getting session:', error);
          setLoading(false);
          return;
        }
        
        if (session?.user) {
          // If it's an anonymous session, sign out and show login screen
          if (session.user.is_anonymous) {
            console.log('⚠️ Found existing anonymous session, signing out...');
            await supabase.auth.signOut();
            if (!mounted) return;
            setUser(null);
            setIsAnonymous(false);
            setLoading(false);
            return;
          }
          
          console.log('✅ Found existing session for user:', session.user.email || 'anonymous');
          setUser(session.user);
          setIsAnonymous(session.user.is_anonymous || false);
          
          // Validate session with a lightweight query
          try {
            const { error: testError } = await supabase
              .from('users')
              .select('id')
              .limit(1)
              .single();
            
            if (!mounted) return;
            
            if (testError && testError.code === 'PGRST301') {
              // Session expired, attempt refresh
              console.log('⚠️ Session expired, attempting refresh...');
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              
              if (!mounted) return;
              
              if (refreshError || !refreshData.session) {
                console.log('❌ Session refresh failed, user needs to sign in again');
                setUser(null);
                setIsAnonymous(false);
              } else {
                console.log('✅ Session refreshed successfully');
                setUser(refreshData.session.user);
                setIsAnonymous(refreshData.session.user.is_anonymous || false);
              }
            } else {
              console.log('✅ Session is valid');
            }
          } catch (sessionError) {
            console.error('⚠️ Session validation error:', sessionError);
            if (!mounted) return;
            
            // Try to refresh on any error
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (!mounted) return;
            
            if (refreshError || !refreshData.session) {
              console.log('❌ Session refresh failed');
              setUser(null);
              setIsAnonymous(false);
            } else {
              console.log('✅ Session refreshed after error');
              setUser(refreshData.session.user);
              setIsAnonymous(refreshData.session.user.is_anonymous || false);
            }
          }
        } else {
          console.log('ℹ️ No existing session found');
          // Don't auto-create anonymous session - let user choose via "Continue as Guest" button
          setUser(null);
          setIsAnonymous(false);
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes - this should NOT depend on fetchCards
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('🔄 Auth state changed:', event, session?.user?.email || 'no user');
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in:', session.user.email || 'anonymous');
        setUser(session.user);
        setIsAnonymous(session.user.is_anonymous || false);
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        setUser(null);
        setIsAnonymous(false);
        setCards([]);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('🔄 Token refreshed for user:', session.user.email || 'anonymous');
        setUser(session.user);
        setIsAnonymous(session.user.is_anonymous || false);
        // Don't refetch cards on token refresh, just update user state
      } else if (event === 'USER_UPDATED' && session?.user) {
        console.log('👤 User updated:', session.user.email || 'anonymous');
        setUser(session.user);
        setIsAnonymous(session.user.is_anonymous || false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    cards,
    isAnonymous,
    refreshSession,
    fetchCards,
    signInAnonymously,
    upgradeAnonymousAccount,
  }), [user, loading, cards, isAnonymous, refreshSession, fetchCards, signInAnonymously, upgradeAnonymousAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
