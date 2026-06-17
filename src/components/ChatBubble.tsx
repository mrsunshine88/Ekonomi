import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

export default function ChatBubble() {
  const { user } = useAuth();
  const [chatGlobalOpen, setChatGlobalOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'waiting' | 'active' | 'closed' | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);

  // Keep ref in sync and reset unread when opening
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  // Sync visitorId from localStorage
  useEffect(() => {
    const id = localStorage.getItem('visitor_session_id');
    setVisitorId(id);
    
    const interval = setInterval(() => {
      const currentId = localStorage.getItem('visitor_session_id');
      if (currentId && !visitorId) {
        setVisitorId(currentId);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [visitorId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Fetch initial chat status and listen to changes
  useEffect(() => {
    const fetchChatStatus = async () => {
      const { data } = await supabase.from('global_settings').select('value').eq('key', 'chat_open').single();
      if (data) {
        setChatGlobalOpen(data.value === 'true');
      }
    };
    
    fetchChatStatus();

    const channel = supabase.channel('global_settings_chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings', filter: 'key=eq.chat_open' }, (payload: { new: { [key: string]: string } }) => {
        setChatGlobalOpen(payload.new.value === 'true');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch existing session and messages if user is logged in or visitor
  useEffect(() => {
    if (!chatGlobalOpen || (!user && !visitorId)) return;

    const initChat = async () => {
      // Find active or waiting session
      let query = supabase
        .from('chat_sessions')
        .select('id, status')
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (user) {
        query = query.eq('user_id', user.id);
      } else if (visitorId) {
        query = query.eq('visitor_id', visitorId);
      } else {
        return;
      }

      const { data: sessionData } = await query.maybeSingle();

      if (sessionData) {
        setSessionId(sessionData.id);
        setSessionStatus(sessionData.status as any);
        // Fetch messages
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionData.id)
          .order('created_at', { ascending: true });
        
        if (msgs) setMessages(msgs);
      }
    };

    initChat();
  }, [user, visitorId, chatGlobalOpen]);

  // Listen to new messages and session status changes if we have a session
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`chat_${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${sessionId}` }, (payload: { new: { [key: string]: any } }) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        
        if (payload.new.sender_type === 'admin' && !isOpenRef.current) {
          setUnreadCount(prev => prev + 1);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_sessions', filter: `id=eq.${sessionId}` }, (payload: { new: { [key: string]: string } }) => {
        if (payload.new.status) {
          setSessionStatus(payload.new.status as 'active' | 'waiting' | 'closed');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Poll queue position when waiting
  useEffect(() => {
    if (sessionStatus !== 'waiting' || !sessionId) {
      setQueuePosition(null);
      return;
    }

    const fetchQueue = async () => {
      const { data: mySession } = await supabase.from('chat_sessions').select('created_at').eq('id', sessionId).single();
      if (mySession) {
        const { count } = await supabase
          .from('chat_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'waiting')
          .lt('created_at', mySession.created_at);
        if (count !== null) setQueuePosition(count + 1);
      }
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 15000);
    return () => clearInterval(interval);
  }, [sessionStatus, sessionId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || (!user && !visitorId) || isSending) return;
    
    setIsSending(true);
    let currentSessionId = sessionId;

    try {
      // Create session if it doesn't exist
      if (!currentSessionId) {
        const insertData: any = {};
        if (user) insertData.user_id = user.id;
        else if (visitorId) insertData.visitor_id = visitorId;

        const { data: newSession, error: sessionErr } = await supabase
          .from('chat_sessions')
          .insert(insertData)
          .select('id')
          .single();
          
        if (sessionErr) throw sessionErr;
        currentSessionId = newSession.id;
        setSessionId(newSession.id);
      }

      // Insert message
      const { data: insertedMsg, error: msgErr } = await supabase
        .from('chat_messages')
        .insert({
          session_id: currentSessionId,
          sender_type: 'user',
          message: inputText.trim()
        })
        .select()
        .single();
        
      if (msgErr) throw msgErr;

      setMessages(prev => {
        if (prev.some(m => m.id === insertedMsg.id)) return prev;
        return [...prev, insertedMsg];
      });

      // Trigger push notification directly via Vercel instead of relying on Supabase Webhooks
      fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record: {
            sender_type: 'user',
            message: inputText.trim()
          }
        })
      }).catch(err => console.error("Push API trigger failed:", err));

      setInputText('');
    } catch (err: any) {
      console.error("Kunde inte skicka meddelande", err);
      alert("Något gick fel: " + (err.message || err.details || JSON.stringify(err)));
    } finally {
      setIsSending(false);
    }
  };

  if (!chatGlobalOpen || (!user && !visitorId)) return null;

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      {isOpen && (
          <div style={{ 
            width: '320px', 
            height: '400px', 
            background: '#0b0f19', 
          borderRadius: '12px', 
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          marginBottom: '10px',
          border: '1px solid var(--border-color)'
        }}>
          {/* Header */}
          <div style={{ background: 'var(--accent-gradient)', padding: '15px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Kundservice</h3>
              {sessionStatus === 'waiting' && queuePosition !== null && (
                <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '2px' }}>Din köplats: {queuePosition}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <button onClick={() => setIsOpen(false)} title="Minimera" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.5rem', lineHeight: '10px', paddingBottom: '8px' }}>_</button>
              <button onClick={async () => {
                if (sessionId && sessionStatus !== 'closed') {
                  await supabase.from('chat_sessions').update({ status: 'closed' }).eq('id', sessionId);
                }
                setSessionId(null);
                setSessionStatus(null);
                setMessages([]);
                setIsOpen(false);
              }} title="Avsluta chatt" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
          </div>

          {/* Messages Area */}
          <div ref={scrollContainerRef} style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '50px' }}>
                <p>👋 Hej! Hur kan vi hjälpa dig idag?</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} style={{ 
                  alignSelf: msg.sender_type === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.sender_type === 'user' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                  color: msg.sender_type === 'user' ? 'white' : 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  maxWidth: '80%',
                  wordBreak: 'break-word'
                }}>
                  {msg.message}
                </div>
              ))
            )}
          </div>

          {/* Input Area */}
          {(sessionStatus as string) === 'closed' ? (
            <div style={{ padding: '15px', borderTop: '1px solid var(--border-color)', textAlign: 'center', color: '#f43f5e', background: 'rgba(255,255,255,0.02)' }}>
              Chatten är avslutad av kundtjänst.<br/>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kryssa ner fönstret för att starta en ny.</span>
            </div>
          ) : (
            <form onSubmit={sendMessage} style={{ padding: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Skriv ett meddelande..." 
                style={{ flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                disabled={isSending || (sessionStatus as string) === 'closed'}
              />
              <button 
                type="submit" 
                disabled={isSending || !inputText.trim() || (sessionStatus as string) === 'closed'}
                style={{ background: (sessionStatus as string) === 'closed' ? 'var(--border-color)' : 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: (sessionStatus as string) === 'closed' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ➤
              </button>
            </form>
          )}
        </div>
      )}

      {/* The Bubble Button */}
      {!isOpen && (
        <div style={{ position: 'relative' }}>
          {unreadCount > 0 && (
            <div style={{ 
              position: 'absolute', top: '-5px', right: '-5px', 
              background: '#f43f5e', color: 'white', borderRadius: '50%', 
              width: '24px', height: '24px', display: 'flex', 
              alignItems: 'center', justifyContent: 'center', 
              fontSize: '0.8rem', fontWeight: 'bold', zIndex: 10,
              boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
            }}>
              {unreadCount}
            </div>
          )}
          <button 
            onClick={() => setIsOpen(true)}
            style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '50%', 
              background: 'var(--accent-gradient)', 
              color: 'white', 
              border: 'none',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s'
            }}
          >
            💬
          </button>
        </div>
      )}
    </div>
  );
}
