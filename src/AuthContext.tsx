import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  householdId: string | null;
  role: 'owner' | 'member' | null;
  tosAccepted: boolean;
  loading: boolean;
  refreshHousehold: () => Promise<void>;
  acceptTos: () => Promise<void>;
  isRecoveringPassword: boolean;
  setIsRecoveringPassword: (val: boolean) => void;
  isAdmin: boolean;
  isNewlyConfirmed: boolean;
  setIsNewlyConfirmed: (val: boolean) => void;
}

// Fånga hash-fragmentet innan Supabase Auth rensar det
const initialHashStr = typeof window !== 'undefined' ? window.location.hash + window.location.search : '';
const initiallyConfirmed = initialHashStr.includes('type=signup') || initialHashStr.includes('code=') || initialHashStr.includes('access_token=');

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  householdId: null,
  role: null,
  tosAccepted: false,
  loading: true,
  refreshHousehold: async () => {},
  acceptTos: async () => {},
  isRecoveringPassword: false,
  setIsRecoveringPassword: () => {},
  isAdmin: false,
  isNewlyConfirmed: false,
  setIsNewlyConfirmed: () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const userRef = React.useRef<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'member' | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isNewlyConfirmed, setIsNewlyConfirmed] = useState(initiallyConfirmed);

  const acceptTos = async () => {
    if (!user) return;
    // Optimistically update to hide the modal instantly
    setTosAccepted(true);
    try {
      const { error } = await supabase.from('profiles').update({ tos_accepted: true }).eq('id', user.id);
      if (error) {
        console.error("Failed to accept TOS", error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHousehold = async (userId: string) => {
    try {
      const { data } = await supabase.from('profiles').select('household_id, role, tos_accepted').eq('id', userId).single();
      if (data?.household_id) {
        setHouseholdId(data.household_id);
        setRole(data.role || 'member');
      } else {
        setHouseholdId(null);
        setRole(null);
      }
      if (data) {
        setTosAccepted(data.tos_accepted || false);
      }
    } catch (e) {
      console.error("Network or fetch error in fetchHousehold:", e);
      // We do NOT reset state here, because a temporary network drop 
      // on mobile shouldn't trigger the TOS modal or wipe the household ID.
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
            try {
              if (session.user.email === 'apersson508@gmail.com') {
                if (mounted) setIsAdmin(true);
              } else {
                const { data: adminStatus } = await supabase.rpc('is_user_admin');
                if (mounted) setIsAdmin(!!adminStatus);
              }
            } catch (err) {
              console.error("Failed to fetch admin status", err);
            }
          } else {
            if (mounted) {
              setIsAdmin(false);
              setHouseholdId(null);
              setRole(null);
              setTosAccepted(false);
            }
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
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoveringPassword(true);
          setIsNewlyConfirmed(false); // Om det är password recovery är det inte en ny bekräftelse
        }

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
          try {
            if (newSession.user.email === 'apersson508@gmail.com') {
              if (mounted) setIsAdmin(true);
            } else {
              const { data: adminStatus } = await supabase.rpc('is_user_admin');
              if (mounted) setIsAdmin(!!adminStatus);
            }
          } catch (err) {
            console.error("Failed to fetch admin status", err);
          }
        } else {
          setHouseholdId(null);
          setIsAdmin(false);
          setRole(null);
          setTosAccepted(false);
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
    <AuthContext.Provider value={{ user, session, householdId, role, tosAccepted, loading, refreshHousehold: async () => { if(user) await fetchHousehold(user.id) }, acceptTos, isRecoveringPassword, setIsRecoveringPassword, isAdmin, isNewlyConfirmed, setIsNewlyConfirmed }}>
      {children}
    </AuthContext.Provider>
  );
}
