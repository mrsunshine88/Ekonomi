import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

interface AgentSession {
  agent_id: string;
  status: 'offline' | 'available' | 'busy';
  agent_email?: string;
}

interface ChatSession {
  id: string;
  user_id: string | null;
  visitor_id: string | null;
  status: string;
  assigned_to: string | null;
  assigned_name: string | null;
  created_at: string;
  profiles?: { email: string } | null;
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
  const [agentStatus, setAgentStatus] = useState<'offline' | 'available' | 'busy'>('offline');
  const [allAgents, setAllAgents] = useState<AgentSession[]>([]);

  // Kö
  const [queue, setQueue] = useState<ChatSession[]>([]);

  // Aktiv chatt
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scrolla till botten
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const [connectError, setConnectError] = useState('');

  // Hämta agent-sessioner och kö
  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, user_id, visitor_id, status, assigned_to, assigned_name, created_at, updated_at')
      .in('status', ['waiting', 'active'])
      .order('created_at', { ascending: true });

    if (error) { console.error('fetchQueue error:', error); return; }

    if (data) {
      const userIds = [...new Set(data.filter((s: any) => s.user_id).map((s: any) => s.user_id as string))];
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds);
        if (profiles) {
          (profiles as Array<{id: string; email: string}>).forEach(p => { emailMap[p.id] = p.email; });
        }
      }
      const enriched = data.map((s: any) => ({
        ...s,
        profiles: s.user_id ? { email: emailMap[s.user_id] || 'Okänd användare' } : null
      }));
      setQueue(enriched);
    }
  };

  const fetchAgents = async () => {
    const { data } = await supabase
      .from('agent_sessions')
      .select('agent_id, status');
    if (data) setAllAgents(data);
  };

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
      await fetchAgents();

      // Auto-återta ärende om agenten navigerade bort och kom tillbaka
      const { data: myActive } = await supabase
        .from('chat_sessions')
        .select('id, user_id, visitor_id, status, assigned_to, assigned_name, created_at, updated_at')
        .eq('assigned_to', user.id)
        .eq('status', 'active')
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
        fetchAgents();
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

  // Ta ärende
  const handleClaim = async (session: ChatSession) => {
    setClaimError('');
    const { data } = await supabase.rpc('claim_chat_session', {
      target_session_id: session.id
    });
    if (data === 'already_taken') {
      setClaimError('Ärendet togs av en kollega precis.');
      await fetchQueue();
      return;
    }
    setAgentStatus('busy');
    setActiveSession(session);
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
    } catch (err) {
      console.error('Kunde inte skicka:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Stäng ärende
  const handleClose = async () => {
    if (!activeSession) return;
    await supabase.rpc('release_chat_session', { target_session_id: activeSession.id });
    setActiveSession(null);
    setAgentStatus('available');
    await fetchQueue();
  };

  // Formatera tid i kö
  const formatWait = (iso: string) => {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const statusColor = { offline: '#6b7280', available: '#10b981', busy: '#f59e0b' };
  const statusLabel = { offline: 'Frånkopplad', available: 'Ledig', busy: 'Aktiv' };

  const pendingQueue = queue.filter(s => s.status === 'waiting' && !s.assigned_to);
  const takenByMe = queue.filter(s => s.assigned_to === user?.id && s.status === 'active');
  const takenByOthers = queue.filter(s => s.assigned_to && s.assigned_to !== user?.id && s.status === 'active');

  const fullscreenStyles: React.CSSProperties = isFullscreen ? {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999, backgroundColor: '#0f172a',
    padding: '2rem', overflowY: 'auto'
  } : {
    maxWidth: '900px', margin: '0 auto', padding: '1rem'
  };

  return (
    <div style={fullscreenStyles}>

      {/* ─── Statusruta ─── */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '1rem 1.5rem',
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Min status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: statusColor[agentStatus],
              boxShadow: `0 0 6px ${statusColor[agentStatus]}`
            }} />
            <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
              Du: {statusLabel[agentStatus]}
            </span>
          </div>
          {/* Andra agenter */}
          {allAgents.filter(a => a.agent_id !== user?.id && a.status !== 'offline').map(a => (
            <div key={a.agent_id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.75 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: statusColor[a.status]
              }} />
              <span style={{ fontSize: '0.85rem' }}>{statusLabel[a.status]}</span>
            </div>
          ))}
        </div>

        {/* Koppla knapp */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
            <button
            onClick={handleDisconnect}
            title={agentStatus === 'busy' ? 'Släpp ärendet och koppla från' : ''}
            style={{
              background: 'transparent', color: '#f43f5e',
              border: '1px solid #f43f5e', padding: '0.6rem 1.4rem',
              borderRadius: '8px', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '0.95rem'
            }}
          >
            🔴 Koppla från
          </button>
          )}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              background: 'rgba(255,255,255,0.1)', color: '#fff',
              border: 'none', padding: '0.6rem 1rem',
              borderRadius: '8px', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '1rem'
            }}
            title={isFullscreen ? "Minimera" : "Helskärm"}
          >
            {isFullscreen ? "🗗" : "🖵"}
          </button>
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

      {/* ─── Aktiv chatt ─── */}
      {activeSession && (
        <div style={{
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: '12px', marginBottom: '1rem', overflow: 'hidden'
        }}>
          <div style={{
            background: 'var(--accent-gradient)', padding: '1rem 1.5rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                💬 Aktiv chatt: {activeSession.profiles?.email || 'Anonym besökare'}
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>Ärende-ID: {activeSession.id.slice(0, 8)}...</div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                padding: '0.5rem 1.1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
              }}
            >
              ✅ Stäng ärende
            </button>
          </div>

          {/* Meddelanden */}
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

          {/* Skriv meddelande */}
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

      {/* ─── Kön ─── */}
      {agentStatus !== 'offline' && (
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', overflow: 'hidden'
        }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              📋 Kö ({pendingQueue.length} väntande)
            </h3>
          </div>

          {claimError && (
            <div style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e', padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}>
              ⚠️ {claimError}
            </div>
          )}

          {pendingQueue.length === 0 && takenByOthers.length === 0 && !activeSession && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Inga väntande ärenden just nu.
            </div>
          )}

          {/* Väntande – kan tas */}
          {pendingQueue.map(s => (
            <div key={s.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
              gap: '1rem', flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#f59e0b', boxShadow: '0 0 8px #f59e0b',
                  animation: 'pulse 1.5s infinite'
                }} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {s.profiles?.email || 'Anonym besökare'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    ⏱ Väntat {formatWait(s.created_at)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleClaim(s)}
                disabled={agentStatus === 'busy'}
                style={{
                  background: agentStatus === 'busy'
                    ? 'rgba(255,255,255,0.05)'
                    : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                  color: '#fff', border: 'none', padding: '0.5rem 1.1rem',
                  borderRadius: '8px', cursor: agentStatus === 'busy' ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold', fontSize: '0.85rem', opacity: agentStatus === 'busy' ? 0.5 : 1
                }}
              >
                🔔 Ta ärende
              </button>
            </div>
          ))}

          {/* Aktiva av kollega */}
          {takenByOthers.map(s => (
            <div key={s.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
              opacity: 0.55, gap: '1rem', flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6b7280' }} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {s.profiles?.email || 'Anonym besökare'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    🔒 Hanteras av {s.assigned_name || 'kollega'}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Mitt eget aktiva ärende i listan */}
          {takenByMe.map(s => (
            <div key={s.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(99,102,241,0.08)', gap: '1rem', flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1' }} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {s.profiles?.email || 'Anonym besökare'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6366f1' }}>
                    ✍️ Du hanterar detta ärende
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
