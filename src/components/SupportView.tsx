import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { SUPPORT_EMAIL, INFO_EMAIL } from '../constants';

type AgentStatusType = 'offline' | 'available' | 'busy' | 'post_work' | 'break' | 'lunch';


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

  useEffect(() => {
    setNotificationsEnabled(localStorage.getItem('chat_notifications') === 'true');
    const savedSignature = localStorage.getItem('agent_signature');
    if (savedSignature) setAgentSignature(savedSignature);
  }, []);

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
      await supabase.rpc('unclaim_chat_session', { target_session_id: activeSession.id });
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

      const sig = localStorage.getItem('agent_signature') || agentSignature;
      const fullMessage = sig ? `${newEmailMessage.trim()}\n\n--\nMed vänliga hälsningar,\n${sig}\nSmart Ekonomi` : newEmailMessage.trim();

      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: session.id,
          sender_type: 'admin',
          message: fullMessage
        });
      if (msgError) throw msgError;

      setNewEmailTo('');
      setNewEmailSubject('');
      setNewEmailMessage('');
      setShowNewEmailModal(false);
      
      const sessionData = await supabase.from('chat_sessions').select('*').eq('id', session.id).single();
      if(sessionData.data) {
        setActiveSession({...sessionData.data, status: 'active'});
        setAgentStatus('busy');
        await supabase.from('agent_sessions').update({ status: 'busy' }).eq('agent_id', user?.id);
      }
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

  const statusColor: Record<AgentStatusType, string> = { offline: '#6b7280', available: '#10b981', busy: '#f59e0b', post_work: '#f97316', break: '#8b5cf6', lunch: '#ec4899' };
  const statusLabel: Record<AgentStatusType, string> = { offline: 'Frånkopplad', available: 'Ledig', busy: 'I ärende', post_work: 'Efterarbete', break: 'Rast', lunch: 'Lunch' };
  const statusIcon: Record<AgentStatusType, string> = { offline: '⚫', available: '🟢', busy: '🟡', post_work: '📝', break: '☕', lunch: '🍔' };

  const fullscreenStyles: React.CSSProperties = isFullscreen ? {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999, backgroundColor: '#0f172a',
    padding: '2rem', overflowY: 'auto'
  } : {
    maxWidth: '900px', margin: '0 auto', padding: '1rem'
  };

  return (
    <div style={fullscreenStyles}>

      {/* ─── Toppmeny ─── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', padding: '1rem 1.5rem', marginBottom: '1.5rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
        }}>
          {/* Min status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: statusColor[agentStatus],
                boxShadow: `0 0 6px ${statusColor[agentStatus]}`
              }} />
              <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                {statusIcon[agentStatus]} Du: {statusLabel[agentStatus]}
              </span>
            </div>
            {/* Andra agenter borttaget enligt begäran */}
          </div>

          {/* Status-väljare & Koppla-knappar */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {agentStatus === 'offline' ? (
              <button
                onClick={handleConnect}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff', border: 'none', padding: '0.6rem 1.4rem',
                  borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem',
                  boxShadow: '0 2px 10px rgba(16,185,129,0.35)'
                }}
              >
                🟢 Koppla på
              </button>
            ) : (
              <>
                {/* Status dropdown – bara om inte i aktivt ärende */}
                {agentStatus !== 'busy' && (
                  <select
                    value={agentStatus}
                    onChange={(e) => handleSetStatus(e.target.value as AgentStatusType)}
                    style={{
                      padding: '0.5rem 0.7rem', fontSize: '0.9rem',
                      background: 'rgba(0,0,0,0.3)', color: statusColor[agentStatus],
                      border: `1px solid ${statusColor[agentStatus]}`,
                      borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                      appearance: 'auto'
                    }}
                  >
                    <option value="available">🟢 Ledig</option>
                    <option value="post_work">📝 Efterarbete</option>
                    <option value="break">☕ Rast</option>
                    <option value="lunch">🍔 Lunch</option>
                  </select>
                )}
                <button
                  onClick={handleDisconnect}
                  title={agentStatus === 'busy' ? 'Släpp ärendet och koppla från' : ''}
                  style={{
                    background: 'transparent', color: '#f43f5e',
                    border: '1px solid #f43f5e', padding: '0.5rem 1rem',
                    borderRadius: '8px', cursor: 'pointer',
                    fontWeight: 'bold', fontSize: '0.85rem'
                  }}
                >
                  🔴 Koppla från
                </button>
              </>
            )}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={() => setShowNewEmailModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: '#fff', border: 'none',
                  padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(139,92,246,0.3)'
                }}
              >
                ✉️ Nytt mejl
              </button>
              <button
                onClick={() => setShowSignatureModal(true)}
                style={{
                  background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                  padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 'bold'
                }}
              >
                ⚙️ Signatur
              </button>
              <button
                onClick={toggleNotifications}
                style={{
                  background: notificationsEnabled ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                  color: notificationsEnabled ? '#10b981' : 'var(--text-secondary)',
                  border: notificationsEnabled ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 'bold'
                }}
              >
                {notificationsEnabled ? '🔔 Notiser PÅ' : '🔕 Notiser AV'}
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                style={{
                  background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none',
                  padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
                title={isFullscreen ? "Stäng helskärm" : "Öppna helskärm"}
              >
                {isFullscreen ? '✖' : '🖵'}
              </button>
            </div>
          </div>
      </div>

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

      {/* ─── Tilldelat ärende (Väntar på att du klickar Ta ärende) ─── */}
      {activeSession && activeSession.status === 'assigned' && (
        <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '12px', marginBottom: '1rem' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🔔</span>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff' }}>Du har tilldelats ett nytt ärende!</h3>
          <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-secondary)' }}>
            {activeSession.ticket_type === 'email' ? '📧 E-post' : '💬 Chatt'} från {activeSession.profiles?.email || activeSession.customer_email || 'Okänd'}
          </p>
          <button 
            onClick={handleAcceptAssigned}
            style={{
              background: 'var(--accent-gradient)', border: 'none', color: '#fff',
              padding: '1rem 2rem', borderRadius: '8px', cursor: 'pointer',
              fontSize: '1.2rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
            }}>
            <span>⚡</span> Ta ärende
          </button>
        </div>
      )}

      {/* ─── Aktiv chatt / mejl (Öppen för redigering) ─── */}
      {activeSession && activeSession.status === 'active' && (
        <div style={{
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: '12px', marginBottom: '1rem', overflow: 'hidden'
        }}>
          <div style={{
            background: 'var(--accent-gradient)', padding: '1rem 1.5rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ flex: 1 }}>
              {activeSession.ticket_type === 'email' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                    📧 E-postärende
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr', gap: '0.5rem', fontSize: '0.9rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px', marginRight: '1rem' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Från:</strong> 
                    <span style={{ fontWeight: 'bold' }}>{activeSession.customer_email || activeSession.profiles?.email || 'Okänd avsändare'}</span>
                    
                    <strong style={{ color: 'var(--text-secondary)' }}>Till:</strong> 
                    <span style={{ 
                      fontWeight: 'bold', 
                      color: activeSession.inbound_address?.includes('info@') ? '#3b82f6' : '#10b981' 
                    }}>
                      {activeSession.inbound_address || 'Okänd mottagare'}
                    </span>
                    
                    {activeSession.email_subject && (
                      <>
                        <strong style={{ color: 'var(--text-secondary)' }}>Ämne:</strong> 
                        <span>{activeSession.email_subject}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.5rem' }}>
                  💬 Aktiv chatt: {activeSession.profiles?.email || 'Anonym besökare'}
                </div>
              )}
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

          {/* Innehåll beroende på ärendetyp */}
          {activeSession.ticket_type === 'email' ? (
            <div style={{ padding: '1rem' }}>
              <div style={{
                background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px',
                color: '#e2e8f0', whiteSpace: 'pre-wrap', fontFamily: 'sans-serif', fontSize: '0.95rem',
                marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {messages.filter(m => m.sender_type !== 'admin').map(m => m.message).join('\n\n') || "Kunde inte ladda mejlet..."}
              </div>
              
              <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Skriv ditt svar här..."
                  style={{
                    width: '100%', padding: '1.5rem', borderRadius: '8px',
                    border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)',
                    color: '#fff', resize: 'vertical', minHeight: '250px', fontFamily: 'inherit', fontSize: '1rem'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={isSending || !inputText.trim()}
                    style={{
                      padding: '1rem 2.5rem', background: 'var(--accent-gradient)', color: '#fff',
                      border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                      fontSize: '1.1rem', opacity: !inputText.trim() ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    📤 Skicka E-post
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Meddelanden (Chatt) */}
              <div ref={scrollRef} style={{
                height: '35vh', maxHeight: '320px', minHeight: '180px',
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
            </>
          )}

        </div>
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
                  disabled={isSendingNewEmail || !newEmailTo.trim() || !newEmailSubject.trim() || !newEmailMessage.trim()}
                  style={{
                    background: '#2563eb', color: '#fff', border: 'none',
                    padding: '0.5rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    opacity: (isSendingNewEmail || !newEmailTo.trim() || !newEmailSubject.trim() || !newEmailMessage.trim()) ? 0.5 : 1,
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
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 2rem' }}>
              
              {/* Från-rad */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 0' }}>
                <span style={{ color: 'var(--text-secondary)', width: '60px', fontSize: '0.9rem' }}>Från</span>
                <select
                  value={newEmailFrom}
                  onChange={(e) => setNewEmailFrom(e.target.value)}
                  style={{
                    flex: 1, border: 'none', background: 'transparent', color: '#fff', 
                    fontSize: '0.95rem', outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value={SUPPORT_EMAIL}>Kundservice ({SUPPORT_EMAIL})</option>
                  <option value={INFO_EMAIL}>Info ({INFO_EMAIL})</option>
                </select>
              </div>

              {/* Till-rad */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 0' }}>
                <span style={{ color: 'var(--text-secondary)', width: '60px', fontSize: '0.9rem' }}>Till</span>
                <input
                  type="email"
                  placeholder=""
                  value={newEmailTo}
                  onChange={(e) => setNewEmailTo(e.target.value)}
                  style={{
                    flex: 1, border: 'none', background: 'transparent', color: '#fff', 
                    fontSize: '0.95rem', outline: 'none'
                  }}
                />
              </div>

              {/* Ämne-rad */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '1rem 0' }}>
                <input
                  type="text"
                  placeholder="Lägg till ett ämne"
                  value={newEmailSubject}
                  onChange={(e) => setNewEmailSubject(e.target.value)}
                  style={{
                    width: '100%', border: 'none', background: 'transparent', color: '#fff', 
                    fontSize: '1.1rem', outline: 'none', fontWeight: '500'
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
