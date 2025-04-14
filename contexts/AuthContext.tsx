import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

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
  fetchCards: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  cards: [],
  refreshSession: async () => null,
  fetchCards: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);

  const refreshSession = async () => {
    try {
      console.log('Attempting to refresh session...');
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing session:', error);
        return;
      }
      console.log('Session refreshed successfully:', session?.user?.id ?? 'no user');
      setUser(session?.user ?? null);
      return session;
    } catch (error) {
      console.error('Error in refreshSession:', error);
      return null;
    }
  };

  const fetchCards = async () => {
    try {
      if (!user) return;

      console.log('Fetching cards for user:', user.id);
      const { data, error: fetchError } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) {
        console.error('Error fetching cards:', fetchError);
        throw fetchError;
      }

      console.log(`Fetched ${data?.length ?? 0} cards`);
      setCards(data || []);
    } catch (err) {
      console.error('Error in fetchCards:', err);
    }
  };

  useEffect(() => {
    // Initial session check
    const initAuth = async () => {
      try {
        console.log('Initializing auth state...');
        const { data: { session } } = await supabase.auth.getSession();
        
        // If no session found or session appears invalid, try to refresh it
        if (!session) {
          console.log('No initial session found, attempting to refresh...');
          const refreshedSession = await refreshSession();
          if (!refreshedSession) {
            console.log('No session available after refresh attempt');
          }
        } else {
          console.log('Initial session found for user:', session?.user?.id ?? 'unknown');
          setUser(session?.user ?? null);
          
          if (session?.user) {
            await fetchCards();
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
      console.log('Auth state changed:', event);
      console.log('New session state:', session ? 'active' : 'none', 'for user:', session?.user?.id ?? 'none');
      
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