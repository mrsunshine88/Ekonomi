import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  householdId: string | null;
  role: 'owner' | 'member' | null;
  loading: boolean;
  refreshHousehold: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  householdId: null,
  role: null,
  loading: true,
  refreshHousehold: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const userRef = React.useRef<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'member' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHousehold = async (userId: string) => {
    try {
      const { data } = await supabase.from('profiles').select('household_id, role').eq('id', userId).single();
      if (data?.household_id) {
        setHouseholdId(data.household_id);
        setRole(data.role || 'member');
      } else {
        setHouseholdId(null);
        setRole(null);
      }
    } catch (e) {
      console.error(e);
      setHouseholdId(null);
      setRole(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Failsafe: Tvinga bort "Laddar..."-skärmen efter 4 sekunder oavsett vad som händer
    const failsafeTimer = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 4000);

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Auth getSession error:", error);
        }
        if (mounted) {
          setSession(session);
          userRef.current = session?.user ?? null;
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchHousehold(session.user.id);
          }
        }
      } catch (err) {
        console.error("Unexpected error in initAuth:", err);
      } finally {
        if (mounted) {
          setLoading(false);
          clearTimeout(failsafeTimer);
        }
      }
    };
    
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      try {
        const currentUserWasNull = !userRef.current; // Kollar ref för att undvika stale state i useEffect-closure
        setSession(newSession);
        userRef.current = newSession?.user ?? null;
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          // Visa bara "Laddar..." om vi aktivt precis loggade in från Login-skärmen
          if (event === 'SIGNED_IN' && currentUserWasNull) {
            setLoading(true);
            setTimeout(() => { if (mounted) setLoading(false); }, 4000);
          }
          await fetchHousehold(newSession.user.id);
        } else {
          setHouseholdId(null);
        }
      } catch (err) {
        console.error("Unexpected error in onAuthStateChange:", err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(failsafeTimer);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, householdId, role, loading, refreshHousehold: async () => { if(user) await fetchHousehold(user.id) } }}>
      {children}
    </AuthContext.Provider>
  );
}
