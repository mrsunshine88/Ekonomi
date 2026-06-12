import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

export default function AdminChat() {
  const [chatOpen, setChatOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedSessionId]);

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('chat_sessions')
      .select('*, profiles(email)')
      .in('status', ['waiting', 'active'])
      .order('updated_at', { ascending: false });
      
    if (data) setSessions(data);
  };

  useEffect(() => {
    const initAdminChat = async () => {
      setLoading(true);
      // Fetch status
      const { data } = await supabase.from('global_settings').select('value').eq('key', 'chat_open').single();
      if (data) setChatOpen(data.value === 'true');
      
      await fetchSessions();
      setLoading(false);
    };

    initAdminChat();

    // Listen to new sessions or status changes
    const channel = supabase.channel('admin_chat_overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, () => {
        fetchSessions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings', filter: 'key=eq.chat_open' }, (payload: any) => {
        setChatOpen(payload.new.value === 'true');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Listen to messages for the selected session
  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', selectedSessionId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
      
      // Update session status to active if it was waiting
      const currentSession = sessions.find(s => s.id === selectedSessionId);
      if (currentSession && currentSession.status === 'waiting') {
        await supabase.from('chat_sessions').update({ status: 'active' }).eq('id', selectedSessionId);
      }
    };

    fetchMessages();

    const channel = supabase.channel(`admin_chat_${selectedSessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${selectedSessionId}` }, (payload: any) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSessionId, sessions]);

  const handleToggleChatOpen = async () => {
    const newVal = !chatOpen;
    setChatOpen(newVal);
    await supabase.rpc('set_global_setting', { setting_key: 'chat_open', setting_value: newVal.toString() });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedSessionId) return;

    try {
      await supabase.from('chat_messages').insert({
        session_id: selectedSessionId,
        sender_type: 'admin',
        message: inputText.trim()
      });
      setInputText('');
    } catch (err) {
      console.error("Fel när meddelande skickades", err);
    }
  };

  const handleCloseSession = async (id: string) => {
    await supabase.from('chat_sessions').update({ status: 'closed' }).eq('id', id);
    if (selectedSessionId === id) setSelectedSessionId(null);
  };

  if (loading) return <div>Laddar chatt-systemet...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Kundservice</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)' }}>Hantera live-chattar från användare</p>
        </div>
        <button 
          onClick={handleToggleChatOpen}
          style={{ 
            padding: '10px 20px', 
            background: chatOpen ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.1)', 
            border: 'none', 
            borderRadius: '8px', 
            color: 'white', 
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {chatOpen ? '🟢 Chatten är Öppen' : '🔴 Chatten är Stängd'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', height: '500px' }}>
        {/* Vänster kolumn: Aktiva sessioner */}
        <div style={{ width: '300px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', overflowY: 'auto' }}>
          <h3 style={{ padding: '15px', margin: 0, borderBottom: '1px solid var(--border-color)' }}>Kö & Aktiva</h3>
          {sessions.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center' }}>Inga aktiva chattar.</div>
          ) : (
            sessions.map(s => (
              <div 
                key={s.id} 
                onClick={() => setSelectedSessionId(s.id)}
                style={{ 
                  padding: '15px', 
                  borderBottom: '1px solid var(--border-color)', 
                  cursor: 'pointer',
                  background: selectedSessionId === s.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>{s.profiles?.email || 'Okänd Användare'}</div>
                  <div style={{ fontSize: '0.8rem', color: s.status === 'waiting' ? '#f43f5e' : '#10b981' }}>
                    {s.status === 'waiting' ? 'Väntar...' : 'Aktiv'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Höger kolumn: Chattruta */}
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
          {!selectedSessionId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              Välj en konversation i listan för att svara
            </div>
          ) : (
            <>
              <div style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>
                  Konversation med {sessions.find(s => s.id === selectedSessionId)?.profiles?.email}
                </h3>
                <button onClick={() => handleCloseSession(selectedSessionId)} style={{ background: 'transparent', border: '1px solid #f43f5e', color: '#f43f5e', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}>Avsluta Ärende</button>
              </div>

              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ 
                    alignSelf: msg.sender_type === 'admin' ? 'flex-end' : 'flex-start',
                    background: msg.sender_type === 'admin' ? 'var(--accent-color)' : 'rgba(0,0,0,0.3)',
                    color: msg.sender_type === 'admin' ? 'white' : 'var(--text-primary)',
                    padding: '10px 15px',
                    borderRadius: '12px',
                    maxWidth: '70%',
                    wordBreak: 'break-word'
                  }}>
                    {msg.message}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} style={{ padding: '15px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Skriv ett svar..." 
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
                <button type="submit" disabled={!inputText.trim()} style={{ padding: '0 20px', background: 'var(--accent-gradient)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Skicka
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
