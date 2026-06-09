import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  householdId: string | null;
  loading: boolean;
  refreshHousehold: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  householdId: null,
  loading: true,
  refreshHousehold: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHousehold = async (userId: string) => {
    try {
      const { data } = await supabase.from('profiles').select('household_id').eq('id', userId).single();
      if (data?.household_id) {
        setHouseholdId(data.household_id);
      } else {
        setHouseholdId(null);
      }
    } catch (e) {
      console.error(e);
      setHouseholdId(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchHousehold(session.user.id);
        }
        setLoading(false);
      }
    };
    
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setLoading(true);
        await fetchHousehold(newSession.user.id);
        setLoading(false);
      } else {
        setHouseholdId(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, householdId, loading, refreshHousehold: async () => { if(user) await fetchHousehold(user.id) } }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
