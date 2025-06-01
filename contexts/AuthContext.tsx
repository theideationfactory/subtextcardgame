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
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  cards: Card[];
  refreshSession: () => Promise<Session | null | undefined>;
  fetchCards: (page?: number, limit?: number, useCache?: boolean) => Promise<Card[]>;
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

  const fetchCards = async (page = 0, limit = 20, useCache = true): Promise<Card[]> => {
    try {
      if (!user) {
        console.log('fetchCards: No authenticated user, skipping card fetch');
        return [];
      }

      // Use cached cards if available and requested
      if (useCache && cards.length > 0 && page === 0) {
        return cards;
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
        const filterCondition = `user_id.eq.${user.id},is_public.eq.true`;
      console.log(`fetchCards: Final query with columns: ${workingColumns} using filter: .or(${filterCondition})`);
        const { data, error: fetchError } = await supabase
          .from('cards')
          .select(workingColumns)
          .or(`user_id.eq.${user.id},is_public.eq.true`)
          .order('created_at', { ascending: false })
          .range(page * limit, (page + 1) * limit - 1);

        if (fetchError) {
          console.error('fetchCards: Final query failed:', fetchError);
          console.error('fetchCards: Error details:', JSON.stringify(fetchError, null, 2));
          throw new Error(`Failed to fetch cards: ${fetchError.message}`);
        }

        console.log(`fetchCards: Successfully fetched ${data?.length || 0} cards`);

        // Explicitly cast data to Card[] | null here using a double assertion
        const fetchedCards: Card[] = (data as unknown as Card[] | null) || [];
        let newCards: Card[];
        if (page === 0) {
          newCards = fetchedCards;
        } else {
          newCards = [...cards, ...fetchedCards];
        }
        setCards(newCards);
        return newCards;

      } catch (queryErr) {
        console.error('fetchCards: Query execution failed:', queryErr);
        throw queryErr;
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error in fetchCards:', errorMessage);
      console.error('Error details:', err);
      return []; // Return empty array on error
    }
    return []; // Should not be reached, but for type safety
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
            await fetchCards(); // This call updates the state, no need to capture return here
          }
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Auth state change
      // Session update
      
      // Handle different auth events
      if (event === 'SIGNED_IN') {
        console.log('User signed in');
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchCards(); // This call updates the state, no need to capture return here
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
          await fetchCards(); // This call updates the state, no need to capture return here
        } else {
          setCards([]);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, cards, refreshSession, fetchCards }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};