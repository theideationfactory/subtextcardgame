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
  fetchCards: (page?: number, limit?: number, useCache?: boolean) => Promise<void>;
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
      if (!user) return;

      // Use cached cards if available and requested
      if (useCache && cards.length > 0 && page === 0) {
        return;
      }

      // Optimized query - remove expensive joins, add pagination
      const { data, error: fetchError } = await supabase
        .from('cards')
        .select('id, name, description, type, role, context, image_url, frame_width, frame_color, name_color, type_color, description_color, context_color, user_id, collection_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (fetchError) {
        console.error('Error fetching cards:', fetchError);
        throw fetchError;
      }

      // Append to existing cards for pagination, or replace for refresh
      if (page === 0) {
        setCards(data || []);
      } else {
        setCards(prev => [...prev, ...(data || [])]);
      }
    } catch (err) {
      console.error('Error in fetchCards:', err);
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