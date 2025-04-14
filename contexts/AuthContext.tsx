import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

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
  refreshSession: () => Promise<void>;
  fetchCards: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  cards: [],
  refreshSession: async () => {},
  fetchCards: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing session:', error);
        return;
      }
      console.log('Session refreshed:', session?.user ?? null);
      setUser(session?.user ?? null);
    } catch (error) {
      console.error('Error in refreshSession:', error);
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
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session check:', session?.user ?? null);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchCards();
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state changed:', _event);
      console.log('New session:', session?.user ?? null);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchCards();
      } else {
        setCards([]);
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