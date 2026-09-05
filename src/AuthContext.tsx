import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  householdId: string | null;
  role: 'owner' | 'member' | null;
  tosAccepted: boolean;
  setupStatus: 'new_user' | 'setup_started' | 'readonly_user' | 'subscriber';
  loading: boolean;
  refreshHousehold: () => Promise<void>;
  acceptTos: () => Promise<void>;
  isRecoveringPassword: boolean;
  setIsRecoveringPassword: (val: boolean) => void;
  isAdmin: boolean;
  isChatAgent: boolean;
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
  setupStatus: 'new_user',
  loading: true,
  refreshHousehold: async () => {},
  acceptTos: async () => {},
  isRecoveringPassword: false,
  setIsRecoveringPassword: () => {},
  isAdmin: false,
  isChatAgent: false,
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
  const [setupStatus, setSetupStatus] = useState<'new_user' | 'setup_started' | 'readonly_user' | 'subscriber'>('new_user');
  const [loading, setLoading] = useState(true);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChatAgent, setIsChatAgent] = useState(false);
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
      const { data, error } = await supabase.from('profiles').select('household_id, role, tos_accepted, setup_status, chat_agent').eq('id', userId).single();
      if (error) {
        throw error;
      }
      if (data?.household_id) {
        setHouseholdId(data.household_id);
        setRole(data.role || 'member');
      } else {
        setHouseholdId(null);
        setRole(null);
      }
      if (data) {
        setTosAccepted(data.tos_accepted || false);
        setSetupStatus(data.setup_status || 'new_user');
        setIsChatAgent(data.chat_agent || false);
      }
    } catch (e) {
      console.error("Network or fetch error in fetchHousehold:", e);
      // We do NOT reset state here, because a temporary network drop 
      // on mobile shouldn't trigger the TOS modal or wipe the household ID.
    }
  };

  useEffect(() => {
    let mounted = true;
    let adminChannel: ReturnType<typeof supabase.channel> | null = null;
    let chatAgentChannel: ReturnType<typeof supabase.channel> | null = null;

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
            const householdPromise = fetchHousehold(session.user.id);
            let adminStatus = false;
            try {
              if (session.user.email === 'apersson508@gmail.com') {
                adminStatus = true;
              } else {
                const { data } = await supabase.rpc('is_user_admin');
                adminStatus = !!data;
              }
            } catch (err) {
              console.error("Failed to fetch admin status", err);
            }
            
            await householdPromise;
            if (mounted) setIsAdmin(adminStatus);

            try {
              if (session.user.email !== 'apersson508@gmail.com') {
                if (adminChannel) supabase.removeChannel(adminChannel);
                adminChannel = supabase.channel(`admin-changes-init-${session.user.id}`)
                  .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'system_admins', filter: `user_id=eq.${session.user.id}` },
                    (payload) => {
                      if (payload.eventType === 'INSERT') { if (mounted) setIsAdmin(true); }
                      if (payload.eventType === 'DELETE') { if (mounted) setIsAdmin(false); }
                    }
                  )
                  .subscribe();
              }

              // Lyssna på profiles.chat_agent-ändringar i realtid
              if (chatAgentChannel) supabase.removeChannel(chatAgentChannel);
              chatAgentChannel = supabase.channel(`chat-agent-changes-init-${session.user.id}`)
                .on(
                  'postgres_changes',
                  { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
                  (payload: { new: { chat_agent?: boolean } }) => {
                    if (typeof payload.new.chat_agent === 'boolean') {
                      if (mounted) setIsChatAgent(payload.new.chat_agent);
                    }
                  }
                )
                .subscribe();
            } catch (err) {
              console.error("Failed to fetch admin status", err);
            }
          } else {
            if (mounted) {
              setIsAdmin(false);
              setHouseholdId(null);
              setRole(null);
              setTosAccepted(false);
              setSetupStatus('new_user');
              sessionStorage.removeItem('setupWizardState');
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
          const householdPromise = fetchHousehold(newSession.user.id);
          let adminStatusResult = false;
          try {
            if (newSession.user.email === 'apersson508@gmail.com') {
              adminStatusResult = true;
            } else {
              const { data } = await supabase.rpc('is_user_admin');
              adminStatusResult = !!data;
            }
          } catch (err) {
            console.error("Failed to fetch admin status", err);
          }
          
          await householdPromise;
          if (mounted) setIsAdmin(adminStatusResult);

          try {            if (newSession.user.email !== 'apersson508@gmail.com') {
              if (adminChannel) supabase.removeChannel(adminChannel);
              adminChannel = supabase.channel(`admin-changes-${newSession.user.id}`)
                .on(
                  'postgres_changes',
                  { event: '*', schema: 'public', table: 'system_admins', filter: `user_id=eq.${newSession.user.id}` },
                  (payload) => {
                    if (payload.eventType === 'INSERT') { if (mounted) setIsAdmin(true); }
                    if (payload.eventType === 'DELETE') { if (mounted) setIsAdmin(false); }
                  }
                )
                .subscribe();
            }

            // Lyssna på profiles.chat_agent-ändringar i realtid
            if (chatAgentChannel) supabase.removeChannel(chatAgentChannel);
            chatAgentChannel = supabase.channel(`chat-agent-changes-${newSession.user.id}`)
              .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${newSession.user.id}` },
                (payload: { new: { chat_agent?: boolean } }) => {
                  if (typeof payload.new.chat_agent === 'boolean') {
                    if (mounted) setIsChatAgent(payload.new.chat_agent);
                  }
                }
              )
              .subscribe();
          } catch (err) {
            console.error("Failed to fetch admin status", err);
          }
        } else {
          setHouseholdId(null);
          setIsAdmin(false);
          setIsChatAgent(false);
          setRole(null);
          setTosAccepted(false);
          setSetupStatus('new_user');
          sessionStorage.removeItem('setupWizardState');
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
      if (adminChannel) supabase.removeChannel(adminChannel);
      if (chatAgentChannel) supabase.removeChannel(chatAgentChannel);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, householdId, role, tosAccepted, setupStatus, loading, refreshHousehold: async () => { if(user) await fetchHousehold(user.id) }, acceptTos, isRecoveringPassword, setIsRecoveringPassword, isAdmin, isChatAgent, isNewlyConfirmed, setIsNewlyConfirmed }}>
      {children}
    </AuthContext.Provider>
  );
}
