import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { SUPPORT_EMAIL, INFO_EMAIL } from '../constants';

type AgentStatusType = 'offline' | 'available' | 'busy' | 'post_work' | 'break' | 'lunch' | 'other_absence';


interface ChatSession {
  id: string;
  user_id: string | null;
  visitor_id: string | null;
  status: string;
  assigned_to: string | null;
  assigned_name: string | null;
  created_at: string;
  updated_at?: string;
  profiles?: { email: string } | null;
  ticket_type?: 'chat' | 'email';
  inbound_address?: string;
  customer_email?: string;
  email_subject?: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

export default function SupportView() {
  const { user } = useAuth();

  // Agent-status
  const [agentStatus, setAgentStatus] = useState<AgentStatusType>('offline');
  const [showAbsenceMenu, setShowAbsenceMenu] = useState(false);


  // Kö (nu dold i UI)

  // Aktiv chatt
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [, setSessionTick] = useState(0);
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [agentSignature, setAgentSignature] = useState('');
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // Nytt e-postmeddelande
  const [showNewEmailModal, setShowNewEmailModal] = useState(false);
  const [newEmailFrom, setNewEmailFrom] = useState(SUPPORT_EMAIL);
  const [newEmailTo, setNewEmailTo] = useState('');
  const [newEmailSubject, setNewEmailSubject] = useState('');
  const [newEmailMessage, setNewEmailMessage] = useState('');
  const [isSendingNewEmail, setIsSendingNewEmail] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    setNotificationsEnabled(localStorage.getItem('chat_notifications') === 'true');
    const savedSignature = localStorage.getItem('agent_signature');
    if (savedSignature) setAgentSignature(savedSignature);
  }, []);

  // Förhindra scroll i bakgrunden när modaler är öppna (speciellt i mobilen)
  useEffect(() => {
    if (showNewEmailModal || showSignatureModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showNewEmailModal, showSignatureModal]);

  // Timers för andrum och aktiv chatt
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldown(c => (c > 0 ? c - 1 : 0));
      setSessionTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scrolla till botten
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const [connectError, setConnectError] = useState('');

  // Hämta agent-sessioner och kö
  const fetchQueue = async () => {};



  // Hämta min egen agent-status vid mount
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      const { data } = await supabase
        .from('agent_sessions')
        .select('status')
        .eq('agent_id', user.id)
        .maybeSingle();
      if (data) setAgentStatus(data.status as any);
      await fetchQueue();


      // Auto-återta ärende om agenten navigerade bort och kom tillbaka
      const { data: myActive } = await supabase
        .from('chat_sessions')
        .select('id, user_id, visitor_id, status, assigned_to, assigned_name, created_at, updated_at, ticket_type, inbound_address, customer_email, email_subject')
        .eq('assigned_to', user.id)
        .in('status', ['active', 'assigned'])
        .maybeSingle();
        
      if (myActive) {
        // Hämta e-post för att berika activeSession (samma som fetchQueue)
        let email = 'Okänd användare';
        if (myActive.user_id) {
          const { data: profile } = await supabase.from('profiles').select('email').eq('id', myActive.user_id).maybeSingle();
          if (profile) email = profile.email;
        }
        const enrichedSession = { ...myActive, profiles: myActive.user_id ? { email } : null };
        
        setActiveSession(enrichedSession as ChatSession);
        
        // Se till att agenten är 'busy'
        if (!data || data.status !== 'busy') {
           await supabase.rpc('agent_connect');
           await supabase.from('agent_sessions').update({ status: 'busy' }).eq('agent_id', user.id);
           setAgentStatus('busy');
        }
      }
    };
    init();

    // Realtime: kö-uppdateringar
    const queueChannel = supabase.channel('support_queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, () => {
        fetchQueue();
      })
      .subscribe();

    // Realtime: agent-närvaro
    const agentChannel = supabase.channel('support_agents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_sessions' }, () => {
      })
      .subscribe();

    // Städa upp agent-session vid stängning av flik
    const handleUnload = () => {
      supabase.rpc('agent_disconnect');
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(agentChannel);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [user]);

  // Realtime: meddelanden i aktiv session
  useEffect(() => {
    if (!activeSession) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', activeSession.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    };
    fetchMessages();

    const channel = supabase.channel(`support_chat_${activeSession.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `session_id=eq.${activeSession.id}`
      }, (payload: { new: ChatMessage }) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeSession]);

  // Auto-Routing: Tilldela äldsta ärendet om jag är ledig och har väntat länge nog
  useEffect(() => {
    const tryAutoAssign = async () => {
      if (agentStatus === 'available' && !activeSession && cooldown === 0) {
        const { data, error } = await supabase.rpc('auto_assign_oldest_chat');
        if (!error && data && data.success) {
           const { data: sessionData } = await supabase.from('chat_sessions').select('*').eq('id', data.session_id).single();
           if (sessionData) {
             setAgentStatus('busy');
             setActiveSession({...sessionData, status: 'assigned'});
           }
        }
      }
    };
    const interval = setInterval(tryAutoAssign, 2000);
    return () => clearInterval(interval);
  }, [agentStatus, activeSession, cooldown]);
  // Koppla upp
  const handleConnect = async () => {
    setConnectError('');
    const { error } = await supabase.rpc('agent_connect');
    if (error) {
      setConnectError('⚠️ Kunde inte koppla upp. Har SQL-skriptet support_setup.sql körts i Supabase? Fel: ' + error.message);
      return;
    }
    setAgentStatus('available');
  };

  // Koppla från
  const handleDisconnect = async () => {
    if (activeSession) {
      // Släpp tillbaka ärendet till kön via RPC för att kringgå RLS
      const { error } = await supabase.rpc('unclaim_chat_session', { target_session_id: activeSession.id });
      if (error) {
        console.error("Fel vid unclaim:", error);
      }
    }
    await supabase.rpc('agent_disconnect');
    setAgentStatus('offline');
    setActiveSession(null);
    await fetchQueue();
  };

  // Ta emot ett tilldelat ärende
  const handleAcceptAssigned = async () => {
    if (!activeSession) return;
    const { data, error } = await supabase.rpc('accept_assigned_chat_session', { target_session_id: activeSession.id });
    if (error || !data) {
       console.error("Fel vid accept_assigned:", error);
       alert("Ärendet kunde inte öppnas, eller togs av en annan agent.");
       setActiveSession(null);
       setAgentStatus('available');
       await fetchQueue();
       return;
    }
    
    // Vi fick ett ärende, sätt det som aktivt
    setActiveSession({...data, status: 'active'});
    
    // Auto-fill signature for email tickets
    if (data.ticket_type === 'email') {
      const sig = localStorage.getItem('agent_signature') || agentSignature;
      if (sig && !inputText.trim()) {
        setInputText(`\n\n--\nMed vänliga hälsningar,\n${sig}\nSmart Ekonomi`);
      }
    }
  };
  const toggleNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Din webbläsare stödjer tyvärr inte notiser.');
      return;
    }
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      localStorage.setItem('chat_notifications', 'false');
    } else {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('chat_notifications', 'true');
      } else {
        alert('Du måste tillåta notiser i din webbläsare för att detta ska fungera.');
      }
    }
  };

  const openNewEmailModal = () => {
    const sig = localStorage.getItem('agent_signature') || agentSignature;
    if (sig) {
      setNewEmailMessage(`\n\n--\nMed vänliga hälsningar,\n${sig}\nSmart Ekonomi`);
    } else {
      setNewEmailMessage('');
    }
    setNewEmailTo('');
    setNewEmailSubject('');
    setShowNewEmailModal(true);
  };

  const handleSendNewEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmailTo.trim() || !newEmailSubject.trim() || !newEmailMessage.trim() || isSendingNewEmail) return;
    setIsSendingNewEmail(true);
    try {
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user?.id,
          status: 'queued',
          assigned_to: user?.id,
          assigned_name: user?.email,
          ticket_type: 'email',
          inbound_address: newEmailFrom,
          customer_email: newEmailTo.trim(),
          email_subject: newEmailSubject.trim()
        })
        .select()
        .single();
      if (sessionError) throw sessionError;

      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: session.id,
          sender_type: 'admin',
          message: newEmailMessage.trim()
        });
      if (msgError) throw msgError;

      setNewEmailTo('');
      setNewEmailSubject('');
      setNewEmailMessage('');
      setShowNewEmailModal(false);
      
      setToastMessage('Mejlet har skickats till kön för utskick!');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Kunde inte skapa e-post:', err);
      alert('Ett fel uppstod när mejlet skulle skapas.');
    } finally {
      setIsSendingNewEmail(false);
    }
  };

  // Skicka meddelande
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeSession || isSending) return;
    setIsSending(true);
    try {
      const { data: msg, error } = await supabase
        .from('chat_messages')
        .insert({
          session_id: activeSession.id,
          sender_type: 'admin',
          message: inputText.trim()
        })
        .select()
        .single();
      if (error) throw error;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setInputText('');
      if (activeSession.ticket_type === 'email') {
        await handleClose();
      }
    } catch (err) {
      console.error('Kunde inte skicka:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Stäng ärende
  const handleClose = async () => {
    if (!activeSession) return;
    await supabase.rpc('release_chat_session', { target_session_id: activeSession.id, next_status: 'available' });
    setActiveSession(null);
    setAgentStatus('available');
    setCooldown(20);
    await fetchQueue();
  };

  // Byt status (Efterarbete / Rast / Lunch)
  const handleSetStatus = async (newStatus: AgentStatusType) => {
    if (newStatus === 'offline') {
      await handleDisconnect();
      return;
    }
    if (activeSession && activeSession.status === 'assigned') {
      const { error } = await supabase.rpc('unclaim_chat_session', { target_session_id: activeSession.id });
      if (error) console.error("Fel vid unclaim:", error);
      setActiveSession(null);
    }
    await supabase.rpc('agent_set_status', { new_status: newStatus });
    setAgentStatus(newStatus);
    if (newStatus === 'available') {
      setCooldown(20);
    } else {
      setCooldown(0);
    }
  };

  // Formatera tid i kö
  const formatWait = (iso: string) => {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const statusColor: Record<AgentStatusType, string> = { offline: '#6b7280', available: '#10b981', busy: '#f59e0b', post_work: '#f97316', break: '#8b5cf6', lunch: '#ec4899', other_absence: '#ef4444' };
  const statusLabel: Record<AgentStatusType, string> = { offline: 'Frånkopplad', available: 'Ledig', busy: 'I ärende', post_work: 'Efterarbete', break: 'Rast', lunch: 'Lunch', other_absence: 'Övrig frånvaro' };



  const fullscreenStyles: React.CSSProperties = isFullscreen ? {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999, backgroundColor: '#0f172a',
    padding: '2rem', overflowY: 'auto'
  } : {
    maxWidth: '900px', margin: '0 auto', padding: '1rem'
  };

  const displayAgentName = agentSignature?.trim() || user?.email?.split('@')[0] || 'Agent';

  return (
    <div style={fullscreenStyles}>
      <style>{`
        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 20px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes pulse-text {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* ─── Toppmeny ─── */}
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          background: '#10b981', color: '#fff', padding: '1rem 2rem',
          borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 100001, fontWeight: 'bold'
        }}>
          ✅ {toastMessage}
        </div>
      )}

      {/* Kontrollpanel visas alltid om vi inte är INNE i en aktiv chatt */}
      {!(activeSession && activeSession.status === 'active') && (
        <div style={{ marginBottom: '2rem' }}>
          {/* Main "Phone" Box */}
          <div style={{
            background: '#1e293b',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '1.5rem 2rem',
            display: 'flex', flexDirection: 'column', gap: '1.5rem',
            boxShadow: '0 15px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
            position: 'relative', overflow: 'visible'
          }}>
            {/* Subtle top gradient */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)', borderRadius: '16px 16px 0 0' }} />

            {/* Header / Name */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.8rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <span style={{ fontWeight: '800', fontSize: '1.2rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem', letterSpacing: '-0.5px', wordBreak: 'break-word' }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                  background: statusColor[agentStatus],
                  boxShadow: `0 0 10px ${statusColor[agentStatus]}`
                }} />
                SmartAgent <span style={{ color: 'var(--text-secondary)', fontWeight: '400', fontSize: '1.1rem' }}>|</span> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayAgentName}</span>
              </span>
            </div>

            {/* Runda Huvudknappar */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', padding: '0.5rem 0', flexWrap: 'wrap' }}>
              
              {/* Koppla på / Ledig / Ta ärende - Grön */}
              <button
                onClick={activeSession?.status === 'assigned' ? handleAcceptAssigned : (agentStatus === 'offline' ? handleConnect : () => handleSetStatus('available'))}
                style={{
                  width: '76px', height: '76px', borderRadius: '50%',
                  background: (agentStatus === 'available' || activeSession?.status === 'assigned') ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.03)',
                  border: (agentStatus === 'available' || activeSession?.status === 'assigned') ? 'none' : `2px solid #10b981`,
                  color: (agentStatus === 'available' || activeSession?.status === 'assigned') ? '#fff' : '#10b981',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: (agentStatus === 'available' && activeSession?.status !== 'assigned') ? '0 8px 25px rgba(16,185,129,0.5)' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: (agentStatus === 'busy' && activeSession?.status !== 'assigned') ? 0.3 : 1,
                  transform: (agentStatus === 'available' || activeSession?.status === 'assigned') ? 'scale(1.05)' : 'scale(1)',
                  animation: activeSession?.status === 'assigned' ? 'pulse-green 1.5s infinite' : 'none',
                }}
                title={activeSession?.status === 'assigned' ? 'Ta ärende' : (agentStatus === 'offline' ? 'Koppla på' : 'Sätt status: Ledig')}
                disabled={agentStatus === 'busy' && activeSession?.status !== 'assigned'}
                onMouseOver={(e) => { if(agentStatus !== 'available' && agentStatus !== 'busy' && activeSession?.status !== 'assigned') e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}}
                onMouseOut={(e) => { if(agentStatus !== 'available' && agentStatus !== 'busy' && activeSession?.status !== 'assigned') e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}}
              >
                {activeSession?.status === 'assigned' ? (
                  <span style={{ fontSize: '1.8rem' }}>⚡</span>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                )}
              </button>

              {/* Frånvaro Meny (Istället för bara Efterarbete) - Orange */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowAbsenceMenu(!showAbsenceMenu)}
                  style={{
                    width: '76px', height: '76px', borderRadius: '50%',
                    background: (agentStatus === 'post_work' || agentStatus === 'break' || agentStatus === 'lunch' || agentStatus === 'other_absence') ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(255,255,255,0.03)',
                    border: (agentStatus === 'post_work' || agentStatus === 'break' || agentStatus === 'lunch' || agentStatus === 'other_absence') ? 'none' : `2px solid #f59e0b`,
                    color: (agentStatus === 'post_work' || agentStatus === 'break' || agentStatus === 'lunch' || agentStatus === 'other_absence') ? '#fff' : '#f59e0b',
                    cursor: agentStatus === 'offline' || (agentStatus === 'busy' && activeSession?.status !== 'assigned') ? 'not-allowed' : 'pointer', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: (agentStatus === 'post_work' || agentStatus === 'break' || agentStatus === 'lunch' || agentStatus === 'other_absence') ? '0 8px 25px rgba(245,158,11,0.5)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    opacity: agentStatus === 'offline' || (agentStatus === 'busy' && activeSession?.status !== 'assigned') ? 0.3 : 1,
                    transform: (agentStatus === 'post_work' || agentStatus === 'break' || agentStatus === 'lunch' || agentStatus === 'other_absence') ? 'scale(1.05)' : 'scale(1)'
                  }}
                  title="Sätt status: Frånvaro"
                  disabled={agentStatus === 'offline' || (agentStatus === 'busy' && activeSession?.status !== 'assigned')}
                  onMouseOver={(e) => { if(!['post_work', 'break', 'lunch', 'other_absence'].includes(agentStatus) && agentStatus !== 'offline' && !(agentStatus === 'busy' && activeSession?.status !== 'assigned')) e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}}
                  onMouseOut={(e) => { if(!['post_work', 'break', 'lunch', 'other_absence'].includes(agentStatus) && agentStatus !== 'offline' && !(agentStatus === 'busy' && activeSession?.status !== 'assigned')) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </button>
                {showAbsenceMenu && (
                  <div style={{
                    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '0.8rem',
                    background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.5rem',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '0.25rem',
                    minWidth: '160px'
                  }}>
                    <button onClick={() => { handleSetStatus('post_work'); setShowAbsenceMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '0.6rem', textAlign: 'left', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem' }} onMouseOver={(e) => e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseOut={(e) => e.currentTarget.style.background='transparent'}>📝 Efterarbete</button>
                    <button onClick={() => { handleSetStatus('break'); setShowAbsenceMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '0.6rem', textAlign: 'left', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem' }} onMouseOver={(e) => e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseOut={(e) => e.currentTarget.style.background='transparent'}>☕ Rast</button>
                    <button onClick={() => { handleSetStatus('lunch'); setShowAbsenceMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '0.6rem', textAlign: 'left', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem' }} onMouseOver={(e) => e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseOut={(e) => e.currentTarget.style.background='transparent'}>🍔 Lunch</button>
                    <button onClick={() => { handleSetStatus('other_absence'); setShowAbsenceMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '0.6rem', textAlign: 'left', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem' }} onMouseOver={(e) => e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseOut={(e) => e.currentTarget.style.background='transparent'}>⛔ Övrig frånvaro</button>
                  </div>
                )}
              </div>

              {/* Nytt mejl - Lila */}
              <button
                onClick={openNewEmailModal}
                style={{
                  width: '76px', height: '76px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.03)',
                  border: `2px solid #8b5cf6`,
                  color: '#8b5cf6',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: agentStatus === 'busy' ? 0.3 : 1
                }}
                title="Skapa nytt mejl"
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(139,92,246,0.3)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </button>

              {/* Koppla från / Rast - Röd */}
              <button
                onClick={handleDisconnect}
                style={{
                  width: '76px', height: '76px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.03)',
                  border: `2px solid #f43f5e`,
                  color: '#f43f5e',
                  cursor: agentStatus === 'offline' ? 'not-allowed' : 'pointer', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: agentStatus === 'offline' ? 0.3 : 1
                }}
                title="Koppla från"
                disabled={agentStatus === 'offline'}
                onMouseOver={(e) => { if(agentStatus !== 'offline') { e.currentTarget.style.background = 'rgba(244,63,94,0.1)'; e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(244,63,94,0.3)'; } }}
                onMouseOut={(e) => { if(agentStatus !== 'offline') { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; } }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
              </button>
            </div>

            {/* Info under knapparna */}
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '1rem', fontWeight: '500' }}>
              {activeSession?.status === 'assigned' ? (
                <span style={{ color: '#10b981', fontWeight: 'bold', animation: 'pulse-text 1.5s infinite', width: '100%', textAlign: 'center' }}>
                  🔔 Nytt ärende från {activeSession.ticket_type === 'email' ? '📧 E-post' : '💬 Chatt'}: {activeSession.profiles?.email || activeSession.customer_email || 'Okänd'}
                </span>
              ) : (
                <>
                  <span style={{ color: statusColor[agentStatus] }}>Status: {statusLabel[agentStatus]}</span>
                  <span>Väntande ärenden: 0</span>
                  <span>Uppkopplad: {agentStatus !== 'offline' ? '00:00' : '--:--'}</span>
                  {agentStatus === 'available' && cooldown > 0 && (
                    <span style={{ color: '#f59e0b' }}>(Nytt ärende om {cooldown}s)</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Underverktyg UTANFÖR rutan (Fixad för mobilen med flexWrap) */}
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem' }}>
            <button
              onClick={() => setShowSignatureModal(true)}
              style={{
                background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', fontSize: '0.9rem', padding: '0.6rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem',
                transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}
              title="Signatur inställningar"
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> 
              Signatur
            </button>
            <button
              onClick={toggleNotifications}
              style={{
                background: notificationsEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', 
                color: notificationsEnabled ? '#10b981' : 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', fontSize: '0.9rem', padding: '0.6rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem',
                transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}
              title={notificationsEnabled ? 'Notiser PÅ' : 'Notiser AV'}
              onMouseOver={(e) => { if(!notificationsEnabled) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}}
              onMouseOut={(e) => { if(!notificationsEnabled) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              Notiser {notificationsEnabled ? 'PÅ' : 'AV'}
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{
                background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', fontSize: '0.9rem', padding: '0.6rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem',
                transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}
              title={isFullscreen ? "Stäng helskärm" : "Öppna helskärm"}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isFullscreen ? (
                  <><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></>
                ) : (
                  <><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></>
                )}
              </svg>
              Helskärm
            </button>
          </div>
        </div>
      )}

      {/* ─── Felmeddelande vid uppkoppling ─── */}
      {connectError && (
        <div style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: '8px', padding: '0.75rem 1.25rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#f43f5e' }}>
          {connectError}
        </div>
      )}

      {/* ─── Offline-meddelande ─── */}
      {agentStatus === 'offline' && (
        <div style={{
          textAlign: 'center', padding: '3rem',
          color: 'var(--text-secondary)', fontSize: '1rem'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
          Koppla upp för att se och ta emot kundärenden.
        </div>
      )}



      {/* ─── Aktiv chatt / mejl (Öppen för redigering) ─── */}
      {activeSession && activeSession.status === 'active' && (
        <>
          {activeSession.ticket_type === 'email' ? (
            <div style={{
              background: '#1c2135',
              borderRadius: '12px', marginBottom: '1rem', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              minHeight: '65vh'
            }}>
              {/* Header (Top bar) */}
              <div style={{ 
                background: '#252b43', padding: '0.75rem 1rem', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
              }}>
                <button
                  onClick={(e) => handleSend(e as any)}
                  disabled={isSending || !inputText.trim() || !(activeSession.customer_email || activeSession.profiles?.email) || !activeSession.email_subject}
                  style={{
                    background: '#3b82f6', color: '#fff', border: 'none', 
                    padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', 
                    fontWeight: 'bold', fontSize: '0.9rem',
                    opacity: (!inputText.trim() || isSending) ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}
                >
                  {isSending ? 'Skickar...' : 'Skicka ›'}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* Status Badge */}
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6',
                    padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}>
                    TAGET ÄRENDE
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>ID: {activeSession.id.slice(0, 8)}</span>
                    <span style={{ margin: '0 0.5rem' }}>•</span>
                    <span>Öppet i {formatWait(activeSession.updated_at || activeSession.created_at)}</span>
                  </div>
                  <button 
                    onClick={handleClose} 
                    title="Avsluta ärende"
                    style={{ 
                      background: 'none', border: 'none', color: 'var(--text-secondary)', 
                      cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '32px', height: '32px', borderRadius: '50%'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                  >
                    ✖
                  </button>
                </div>
              </div>

              {/* Från, Till, Ämne */}
              <div style={{ display: 'flex', flexDirection: 'column', padding: '0 1.5rem' }}>
                {/* Från-rad */}
                <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 0' }}>
                  <span style={{ color: 'var(--text-secondary)', width: '60px', fontSize: '0.85rem' }}>Från</span>
                  <span style={{ color: '#fff', fontSize: '0.9rem' }}>
                    {activeSession.inbound_address?.includes('info@') ? `Info (${INFO_EMAIL})` : `Kundservice (${SUPPORT_EMAIL})`}
                  </span>
                </div>

                {/* Till-rad */}
                <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 0' }}>
                  <span style={{ color: 'var(--text-secondary)', width: '60px', fontSize: '0.85rem' }}>Till</span>
                  <span style={{ color: '#fff', fontSize: '0.9rem' }}>
                    {activeSession.customer_email || activeSession.profiles?.email || 'Okänd avsändare'}
                  </span>
                </div>

                {/* Ämne-rad */}
                <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.6rem 0' }}>
                  <span style={{ color: '#fff', fontSize: '1rem', fontWeight: '500' }}>
                    {activeSession.email_subject?.startsWith('Re:') ? activeSession.email_subject : `Re: ${activeSession.email_subject || 'Ärende'}`}
                  </span>
                </div>

                {/* Text-editor yta */}
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '1rem', paddingBottom: '1rem', flex: 1 }}>
                  <textarea
                    placeholder="Skriv ditt svar här..."
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    style={{
                      width: '100%', border: 'none', background: 'transparent', 
                      color: '#e2e8f0', fontSize: '1rem', resize: 'vertical', outline: 'none', 
                      fontFamily: 'inherit', lineHeight: '1.6', minHeight: '350px', flex: 1
                    }}
                  />
                  
                  {/* Tidigare meddelanden */}
                  <div style={{ 
                    marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Ursprungligt meddelande:
                    </div>
                    <div style={{
                      background: 'rgba(0,0,0,0.2)', borderLeft: '4px solid rgba(255,255,255,0.2)',
                      padding: '1rem', borderRadius: '0 8px 8px 0',
                      color: 'var(--text-secondary)', fontSize: '0.95rem', whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                      lineHeight: '1.5'
                    }}>
                      {messages.filter(m => m.sender_type !== 'admin').map(m => m.message).join('\n\n') || "Kunde inte ladda mejlet..."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '12px', marginBottom: '1rem', overflow: 'hidden'
            }}>
              <div style={{
                background: 'var(--accent-gradient)', padding: '1rem 1.5rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.5rem' }}>
                    💬 Aktiv chatt: {activeSession.profiles?.email || 'Anonym besökare'}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', opacity: 0.85 }}>
                    <span>Ärende-ID: {activeSession.id.slice(0, 8)}...</span>
                    <span style={{ fontWeight: 'bold' }}>⏱ Öppet i {formatWait(activeSession.updated_at || activeSession.created_at)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    onClick={handleClose}
                    style={{
                      background: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                      padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                    }}
                  >
                    ✅ Avsluta ärende
                  </button>
                </div>
              </div>
              
              {/* Meddelanden (Chatt) */}
              <div ref={scrollRef} style={{
                height: '60vh', minHeight: '400px',
                overflowY: 'auto', padding: '1rem',
                display: 'flex', flexDirection: 'column', gap: '0.6rem'
              }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '4rem' }}>
                    Inga meddelanden än.
                  </div>
                )}
                {messages.map(msg => (
                  <div key={msg.id} style={{
                    alignSelf: msg.sender_type === 'admin' ? 'flex-end' : 'flex-start',
                    background: msg.sender_type === 'admin' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                    color: '#fff', padding: '0.6rem 1rem', borderRadius: '12px',
                    maxWidth: '75%', wordBreak: 'break-word', fontSize: '0.9rem'
                  }}>
                    {msg.message}
                  </div>
                ))}
              </div>

              {/* Skriv meddelande (Chatt) */}
              <form onSubmit={handleSend} style={{
                display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem',
                borderTop: '1px solid rgba(255,255,255,0.08)'
              }}>
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (inputText.trim()) handleSend(e as any); }
                  }}
                  placeholder="Skriv svar... (Enter för att skicka)"
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '8px',
                    border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)',
                    color: '#fff', resize: 'none', height: '72px', fontFamily: 'inherit', fontSize: '0.9rem'
                  }}
                />
                <button
                  type="submit"
                  disabled={isSending || !inputText.trim()}
                  style={{
                    padding: '0 1.25rem', background: 'var(--accent-gradient)', color: '#fff',
                    border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                    opacity: !inputText.trim() ? 0.5 : 1
                  }}
                >
                  Skicka
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {/* ─── Kön (DOLD ENLIGT ÖNSKEMÅL) ─── */}
      {/* <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}> ... </div> */}

      {/* ─── Signatur Modal ─── */}
      {showSignatureModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(11, 15, 25, 0.9)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000
        }}>
          <div style={{
            background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
            padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#fff' }}>⚙️ Min e-postsignatur</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Fyll i ditt för- och efternamn. Detta kommer automatiskt klistras in i slutet av alla dina e-post-svar som en färdig mall.
            </p>
            <input
              type="text"
              placeholder="T.ex. Anna Andersson"
              value={agentSignature}
              onChange={(e) => setAgentSignature(e.target.value)}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '8px',
                border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)',
                color: '#fff', marginBottom: '1.5rem', fontSize: '1rem'
              }}
            />
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowSignatureModal(false)}
                style={{ background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                Avbryt
              </button>
              <button 
                onClick={() => {
                  localStorage.setItem('agent_signature', agentSignature);
                  setShowSignatureModal(false);
                }}
                style={{
                  background: 'var(--accent-gradient)', color: '#fff', border: 'none',
                  padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                Spara Signatur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Nytt Mejl Modal (Proffsig E-postklient) ─── */}
      {showNewEmailModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000
        }}>
          <div style={{
            background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
            width: '90%', maxWidth: '1000px', height: '85vh', borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden'
          }}>
            
            {/* Top Toolbar */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={handleSendNewEmail}
                  disabled={isSendingNewEmail || !newEmailFrom.trim() || !newEmailTo.trim() || !newEmailSubject.trim() || !newEmailMessage.trim()}
                  style={{
                    background: '#2563eb', color: '#fff', border: 'none',
                    padding: '0.5rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    opacity: (isSendingNewEmail || !newEmailFrom.trim() || !newEmailTo.trim() || !newEmailSubject.trim() || !newEmailMessage.trim()) ? 0.5 : 1,
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                  }}
                >
                  <span>{isSendingNewEmail ? 'Skickar...' : 'Skicka'}</span> 
                  {!isSendingNewEmail && <span style={{ fontSize: '1.1rem' }}>›</span>}
                </button>
              </div>
              <button 
                onClick={() => setShowNewEmailModal(false)} 
                title="Stäng (Kasta utkast)"
                style={{ 
                  background: 'none', border: 'none', color: 'var(--text-secondary)', 
                  cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '32px', height: '32px', borderRadius: '50%'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
              >
                ✖
              </button>
            </div>

            {/* Innehållsyta */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 1rem', overflowY: 'auto' }}>
              
              {/* Från-rad */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.2)', padding: '0.35rem 0' }}>
                <span style={{ color: 'var(--text-secondary)', width: '60px', fontSize: '0.85rem' }}>Från</span>
                <select
                  value={newEmailFrom}
                  onChange={(e) => setNewEmailFrom(e.target.value)}
                  style={{
                    flex: 1, border: 'none', background: 'transparent', color: '#fff', 
                    fontSize: '0.9rem', outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value={SUPPORT_EMAIL}>Kundservice ({SUPPORT_EMAIL})</option>
                  <option value={INFO_EMAIL}>Info ({INFO_EMAIL})</option>
                </select>
              </div>

              {/* Till-rad */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.2)', padding: '0.35rem 0' }}>
                <span style={{ color: 'var(--text-secondary)', width: '60px', fontSize: '0.85rem' }}>Till</span>
                <input
                  type="email"
                  placeholder=""
                  value={newEmailTo}
                  onChange={(e) => setNewEmailTo(e.target.value)}
                  style={{
                    flex: 1, border: 'none', background: 'transparent', color: '#fff', 
                    fontSize: '0.9rem', outline: 'none'
                  }}
                />
              </div>

              {/* Ämne-rad */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.2)', padding: '0.45rem 0' }}>
                <input
                  type="text"
                  placeholder="Lägg till ett ämne"
                  value={newEmailSubject}
                  onChange={(e) => setNewEmailSubject(e.target.value)}
                  style={{
                    width: '100%', border: 'none', background: 'transparent', color: '#fff', 
                    fontSize: '1rem', outline: 'none', fontWeight: '500'
                  }}
                />
              </div>

              {/* Text-editor yta */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '1rem', paddingBottom: '1rem' }}>
                <textarea
                  placeholder=""
                  value={newEmailMessage}
                  onChange={(e) => setNewEmailMessage(e.target.value)}
                  style={{
                    flex: 1, width: '100%', border: 'none', background: 'transparent', 
                    color: '#e2e8f0', fontSize: '1rem', resize: 'none', outline: 'none', 
                    fontFamily: 'inherit', lineHeight: '1.6'
                  }}
                />
              </div>
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
