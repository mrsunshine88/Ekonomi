import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function AdminChat() {
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(localStorage.getItem('chat_notifications') === 'true');
    }
  }, []);

  // Scroll to bottom when messages change without moving the whole page
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
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

    const channel = supabase.channel('admin_chat_overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, () => {
        fetchSessions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings', filter: 'key=eq.chat_open' }, (payload: { new: { [key: string]: string } }) => {
        setChatOpen(payload.new.value === 'true');
      })
      .subscribe();

    const notifyChannel = supabase.channel('admin_chat_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: "sender_type=eq.user" }, (payload: { new: { [key: string]: string } }) => {
        if (localStorage.getItem('chat_notifications') === 'true' && 'Notification' in window && Notification.permission === 'granted') {
           new Notification('Nytt Kundtjänst-meddelande', { body: payload.new.message });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(notifyChannel);
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${selectedSessionId}` }, (payload: { new: { [key: string]: any } }) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
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

  const toggleNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Din webbläsare stödjer tyvärr inte notiser.');
      return;
    }

    if (notificationsEnabled) {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
            if (user?.email) {
              await supabase.from('admin_push_subscriptions').delete().eq('admin_email', user.email);
            }
          }
        } catch (e) {
          console.error("Unsubscribe error", e);
        }
      }
      setNotificationsEnabled(false);
      localStorage.setItem('chat_notifications', 'false');
    } else {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if ('serviceWorker' in navigator && 'PushManager' in window && publicVapidKey) {
          try {
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
              });
            }
            
            if (user?.email) {
              const { error } = await supabase.from('admin_push_subscriptions').insert({
                admin_email: user.email,
                subscription: subscription
              });
              if (error) throw error;
            }
            
            setNotificationsEnabled(true);
            localStorage.setItem('chat_notifications', 'true');
          } catch (err: unknown) {
            console.error("Push subscription failed", err);
            alert("Ett fel uppstod: " + ((err instanceof Error ? err.message : String(err)) || JSON.stringify(err)) + ". Om det står 'relation does not exist' måste du köra SQL-skriptet i Supabase.");
            // Fallback
            setNotificationsEnabled(true);
            localStorage.setItem('chat_notifications', 'true');
          }
        } else {
          // Fallback to local notifications
          setNotificationsEnabled(true);
          localStorage.setItem('chat_notifications', 'true');
        }
      } else {
        alert('Du måste tillåta notiser i din webbläsare för att detta ska fungera.');
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedSessionId) return;

    try {
      const { data: insertedMsg, error } = await supabase.from('chat_messages').insert({
        session_id: selectedSessionId,
        sender_type: 'admin',
        message: inputText.trim()
      }).select().single();
      
      if (error) throw error;
      
      setMessages(prev => {
        if (prev.some(m => m.id === insertedMsg.id)) return prev;
        return [...prev, insertedMsg];
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

  const fullscreenStyles: React.CSSProperties = isFullscreen ? {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    background: '#0b0f19',
    padding: '20px',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column'
  } : { display: 'flex', flexDirection: 'column', height: '100%' };

  return (
    <div style={fullscreenStyles}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Kundservice</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)' }}>Hantera live-chattar från användare</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{ 
              padding: '10px 20px', 
              background: 'rgba(255,255,255,0.1)', 
              border: 'none', 
              borderRadius: '8px', 
              color: 'white', 
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {isFullscreen ? '✖ Stäng Helskärm' : '🔲 Helskärm'}
          </button>
          <button 
            onClick={toggleNotifications}
            style={{ 
              padding: '10px 20px', 
              background: notificationsEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)', 
              border: notificationsEnabled ? '1px solid #10b981' : '1px solid transparent', 
              borderRadius: '8px', 
              color: notificationsEnabled ? '#10b981' : 'white', 
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {notificationsEnabled ? '🔔 Notiser PÅ' : '🔕 Notiser AV'}
          </button>
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
      </div>

      <div className="admin-chat-layout">
        {/* Vänster kolumn: Aktiva sessioner */}
        <div className="admin-chat-sidebar">
          <h3 style={{ padding: '15px', margin: 0, borderBottom: '1px solid var(--border-color)' }}>Kö & Aktiva</h3>
          <div className="admin-chat-sidebar-content">
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
                  <div style={{ fontWeight: 'bold' }}>{s.profiles?.email || 'Oinloggad Besökare'}</div>
                  <div style={{ fontSize: '0.8rem', color: s.status === 'waiting' ? '#f43f5e' : '#10b981' }}>
                    {s.status === 'waiting' ? 'Väntar...' : 'Aktiv'}
                  </div>
                </div>
              </div>
            ))
          )}
          </div>
        </div>

        {/* Höger kolumn: Chattruta */}
        <div className="admin-chat-main">
          {!selectedSessionId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              Välj en konversation i listan för att svara
            </div>
          ) : (
            <>
              <div style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, wordBreak: 'break-all', flex: 1, minWidth: '200px' }}>
                  Konversation med {sessions.find(s => s.id === selectedSessionId)?.profiles?.email || 'Oinloggad Besökare'}
                </h3>
                <button onClick={() => handleCloseSession(selectedSessionId)} style={{ background: 'transparent', border: '1px solid #f43f5e', color: '#f43f5e', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Avsluta Ärende</button>
              </div>

              <div ref={scrollContainerRef} style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
              </div>

              <form onSubmit={handleSendMessage} style={{ padding: '15px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
                <textarea 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (inputText.trim()) handleSendMessage(e as any);
                    }
                  }}
                  placeholder="Skriv ett svar... (Enter för att skicka)" 
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white', minHeight: '80px', height: '80px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: '1.5' }}
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
