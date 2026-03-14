<<<<<<< HEAD
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session, PostgrestError } from '@supabase/supabase-js';
import { log, logError } from '@/utils/logger';
=======
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e

type Card = {
  id: string;
  name: string;
  description: string;
<<<<<<< HEAD
  image_description?: string;
=======
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
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
<<<<<<< HEAD
  shared_with_user_ids?: string[];
  is_shared_with_friends?: boolean;
=======
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  cards: Card[];
<<<<<<< HEAD
  isAnonymous: boolean;
  refreshSession: () => Promise<Session | null | undefined>;
  fetchCards: (page?: number, limit?: number, useCache?: boolean, scope?: string) => Promise<Card[]>;
  signInAnonymously: () => Promise<User | null>;
  upgradeAnonymousAccount: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
=======
  refreshSession: () => Promise<Session | null | undefined>;
  fetchCards: (page?: number, limit?: number, useCache?: boolean) => Promise<void>;
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  cards: [],
<<<<<<< HEAD
  isAnonymous: false,
  refreshSession: async () => null,
  fetchCards: async () => [],
  signInAnonymously: async () => null,
  upgradeAnonymousAccount: async () => ({ success: false }),
=======
  refreshSession: async () => null,
  fetchCards: async () => {},
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
<<<<<<< HEAD
  const [isAnonymous, setIsAnonymous] = useState(false);

  const signInAnonymously = useCallback(async () => {
    try {
      log('👤 Creating anonymous session...');
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        logError('❌ Anonymous sign-in error:', error.message);
        return null;
      }

      if (data?.user) {
        log('✅ Anonymous user created:', data.user.id);
        setUser(data.user);
        setIsAnonymous(true);
        return data.user;
      }

      return null;
    } catch (e) {
      logError('❌ Unexpected error during anonymous sign-in:', e);
      return null;
    }
  }, []);

  const upgradeAnonymousAccount = useCallback(async (email: string, password: string) => {
    try {
      if (!isAnonymous || !user) {
        return { success: false, error: 'Not an anonymous user' };
      }

      log('⬆️ Upgrading anonymous account to full account...');
      
      // Update user with both email and password in one call
      // This works when manual linking is enabled in Supabase
      const { data, error } = await supabase.auth.updateUser({
        email,
        password,
      });

      if (error) {
        logError('❌ Account upgrade error:', error.message);
        
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
        log('✅ Account upgraded successfully:', data.user.email);
        setUser(data.user);
        setIsAnonymous(false);
        return { success: true };
      }

      return { success: false, error: 'Unknown error' };
    } catch (e) {
      logError('❌ Unexpected error during account upgrade:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }, [isAnonymous, user]);

  const refreshSession = useCallback(async () => {
    try {
      log('🔄 Refreshing session...');
      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error) {
        logError('❌ Session refresh error:', error.message);
        return null;
      }

      if (session?.user) {
        log('✅ Session refreshed successfully for user:', session.user.email || 'anonymous');
        setUser(session.user);
        setIsAnonymous(session.user.is_anonymous || false);
        return session;
      }

      log('⚠️ No session returned after refresh');
      return null;
    } catch (e) {
      logError('❌ Unexpected error during session refresh:', e);
      return null;
    }
  }, []);

  const fetchCards = useCallback(
    async (page = 0, limit = 20, useCache = true, scope = 'personal'): Promise<Card[]> => {
      try {
        // Early return if no user for scopes that require authentication
        const uid = user?.id;
        if (!uid) {
          log('No authenticated user, returning empty cards array');
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
          logError('Error fetching cards:', error);
          return [];
        }

        const fetchedCards = (data || []) as Card[];
        setCards(prev => (JSON.stringify(prev) === JSON.stringify(fetchedCards) ? prev : fetchedCards));
        return fetchedCards;
      } catch (e) {
        logError('Unexpected error fetching cards:', e);
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
        log('🔄 Initializing authentication...');
        
        // Get current session from storage
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          logError('❌ Error getting session:', error);
          setLoading(false);
          return;
        }
        
        if (session?.user) {
          // If it's an anonymous session, sign out and show login screen
          if (session.user.is_anonymous) {
            log('⚠️ Found existing anonymous session, signing out...');
            await supabase.auth.signOut();
            if (!mounted) return;
            setUser(null);
            setIsAnonymous(false);
            setLoading(false);
            return;
          }
          
          log('✅ Found existing session for user:', session.user.email || 'anonymous');
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
              log('⚠️ Session expired, attempting refresh...');
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              
              if (!mounted) return;
              
              if (refreshError || !refreshData.session) {
                log('❌ Session refresh failed, user needs to sign in again');
                setUser(null);
                setIsAnonymous(false);
              } else {
                log('✅ Session refreshed successfully');
                setUser(refreshData.session.user);
                setIsAnonymous(refreshData.session.user.is_anonymous || false);
              }
            } else {
              log('✅ Session is valid');
            }
          } catch (sessionError) {
            logError('⚠️ Session validation error:', sessionError);
            if (!mounted) return;
            
            // Try to refresh on any error
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (!mounted) return;
            
            if (refreshError || !refreshData.session) {
              log('❌ Session refresh failed');
              setUser(null);
              setIsAnonymous(false);
            } else {
              log('✅ Session refreshed after error');
              setUser(refreshData.session.user);
              setIsAnonymous(refreshData.session.user.is_anonymous || false);
            }
          }
        } else {
          log('ℹ️ No existing session found');
          // Don't auto-create anonymous session - let user choose via "Continue as Guest" button
          setUser(null);
          setIsAnonymous(false);
        }
      } catch (error) {
        logError('❌ Auth initialization error:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
=======

  const refreshSession = async () => {
    try {
      // Removed verbose logging
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing session:', error);
        return;
      }
      // Session refresh successful
      setUser(session?.user ?? null);
      return session;
    } catch (error) {
      console.error('Error in refreshSession:', error);
      return null;
    }
  };

  const fetchCards = async (page = 0, limit = 20, useCache = true) => {
    try {
      if (!user) {
        console.log('fetchCards: No authenticated user, skipping card fetch');
        return;
      }

      // Use cached cards if available and requested
      if (useCache && cards.length > 0 && page === 0) {
        return;
      }

      console.log(`fetchCards: Fetching cards for user ${user.id}, page ${page}`);

      // First, let's try a simple query to test basic connectivity
      const { data: testData, error: testError } = await supabase
        .from('cards')
        .select('count', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (testError) {
        console.error('fetchCards: Test query failed:', testError);
        throw new Error(`Database connectivity test failed: ${testError.message}`);
      }

      console.log(`fetchCards: Test query successful, user has ${testData} cards`);

      // Start with basic columns and gradually add more to identify the problematic column
      let selectColumns = 'id, name, description, type, role, context, image_url, user_id, created_at';
      
      try {
        // Try with basic columns first
        console.log('fetchCards: Trying basic columns...');
        const { data: basicData, error: basicError } = await supabase
          .from('cards')
          .select(selectColumns)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(page * limit, (page + 1) * limit - 1);

        if (basicError) {
          console.error('fetchCards: Basic query failed:', basicError);
          throw new Error(`Basic query failed: ${basicError.message}`);
        }

        console.log(`fetchCards: Basic query successful, got ${basicData?.length || 0} cards`);

        // Now try adding the additional columns one by one
        const additionalColumns = ['frame_width', 'frame_color', 'name_color', 'type_color', 'description_color', 'context_color', 'collection_id'];
        let workingColumns = selectColumns;

        for (const col of additionalColumns) {
          try {
            const testSelect = `${workingColumns}, ${col}`;
            console.log(`fetchCards: Testing with column: ${col}`);
            
            const { data: testColData, error: testColError } = await supabase
              .from('cards')
              .select(testSelect)
              .eq('user_id', user.id)
              .limit(1);

            if (testColError) {
              console.error(`fetchCards: Column ${col} failed:`, testColError);
              // Skip this column and continue
              continue;
            }

            // If successful, add to working columns
            workingColumns = testSelect;
            console.log(`fetchCards: Column ${col} works fine`);
          } catch (colErr) {
            console.error(`fetchCards: Error testing column ${col}:`, colErr);
          }
        }

        // Now do the final query with all working columns
        console.log(`fetchCards: Final query with columns: ${workingColumns}`);
        const { data, error: fetchError } = await supabase
          .from('cards')
          .select(workingColumns)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(page * limit, (page + 1) * limit - 1);

        if (fetchError) {
          console.error('fetchCards: Final query failed:', fetchError);
          console.error('fetchCards: Error details:', JSON.stringify(fetchError, null, 2));
          throw new Error(`Failed to fetch cards: ${fetchError.message}`);
        }

        console.log(`fetchCards: Successfully fetched ${data?.length || 0} cards`);

        // Append to existing cards for pagination, or replace for refresh
        if (page === 0) {
          setCards((data as any[]) || []);
        } else {
          setCards(prev => [...prev, ...((data as any[]) || [])]);
        }

      } catch (queryErr) {
        console.error('fetchCards: Query execution failed:', queryErr);
        throw queryErr;
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error in fetchCards:', errorMessage);
      console.error('Error details:', err);
    }
  };

  useEffect(() => {
    // Initial session check
    const initAuth = async () => {
      try {
        // Auth init
        const { data: { session } } = await supabase.auth.getSession();
        
        // If no session found or session appears invalid, try to refresh it
        if (!session) {
          // No initial session
          const refreshedSession = await refreshSession();
          if (!refreshedSession) {
            // No session after refresh
          }
        } else {
          // Session found
          setUser(session?.user ?? null);
          
          if (session?.user) {
            await fetchCards();
          }
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
      }
    };

    initAuth();

<<<<<<< HEAD
    // Listen for auth changes - this should NOT depend on fetchCards
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      log('🔄 Auth state changed:', event, session?.user?.email || 'no user');
      
      if (event === 'SIGNED_IN' && session?.user) {
        log('✅ User signed in:', session.user.email || 'anonymous');
        setUser(session.user);
        setIsAnonymous(session.user.is_anonymous || false);
      } else if (event === 'SIGNED_OUT') {
        log('👋 User signed out');
        setUser(null);
        setIsAnonymous(false);
        setCards([]);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        log('🔄 Token refreshed for user:', session.user.email || 'anonymous');
        setUser(session.user);
        setIsAnonymous(session.user.is_anonymous || false);
        // Don't refetch cards on token refresh, just update user state
      } else if (event === 'USER_UPDATED' && session?.user) {
        log('👤 User updated:', session.user.email || 'anonymous');
        setUser(session.user);
        setIsAnonymous(session.user.is_anonymous || false);
=======
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Auth state change
      // Session update
      
      // Handle different auth events
      if (event === 'SIGNED_IN') {
        console.log('User signed in');
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchCards();
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        setUser(null);
        setCards([]);
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed');
        setUser(session?.user ?? null);
      } else if (event === 'USER_UPDATED') {
        console.log('User updated');
        setUser(session?.user ?? null);
      } else {
        // For any other event, update the user state
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchCards();
        } else {
          setCards([]);
        }
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
      }
    });

    return () => {
<<<<<<< HEAD
      mounted = false;
=======
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
      subscription.unsubscribe();
    };
  }, []);

<<<<<<< HEAD
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
=======
  return (
    <AuthContext.Provider value={{ user, loading, cards, refreshSession, fetchCards }}>
      {children}
    </AuthContext.Provider>
  );
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
<<<<<<< HEAD
};
=======
};
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
