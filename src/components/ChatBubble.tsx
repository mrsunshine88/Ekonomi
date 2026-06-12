import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

export default function ChatBubble() {
  const { user } = useAuth();
  const [chatGlobalOpen, setChatGlobalOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings', filter: 'key=eq.chat_open' }, (payload: any) => {
        setChatGlobalOpen(payload.new.value === 'true');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch existing session and messages if user is logged in
  useEffect(() => {
    if (!user || !chatGlobalOpen) return;

    const initChat = async () => {
      // Find active or waiting session
      const { data: sessionData } = await supabase
        .from('chat_sessions')
        .select('id, status')
        .eq('user_id', user.id)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sessionData) {
        setSessionId(sessionData.id);
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
  }, [user, chatGlobalOpen]);

  // Listen to new messages if we have a session
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`chat_${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${sessionId}` }, (payload: any) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || isSending) return;
    
    setIsSending(true);
    let currentSessionId = sessionId;

    try {
      // Create session if it doesn't exist
      if (!currentSessionId) {
        const { data: newSession, error: sessionErr } = await supabase
          .from('chat_sessions')
          .insert({ user_id: user.id })
          .select('id')
          .single();
          
        if (sessionErr) throw sessionErr;
        currentSessionId = newSession.id;
        setSessionId(newSession.id);
      }

      // Insert message
      const { error: msgErr } = await supabase
        .from('chat_messages')
        .insert({
          session_id: currentSessionId,
          sender_type: 'user',
          message: inputText.trim()
        });
        
      if (msgErr) throw msgErr;
      setInputText('');
    } catch (err) {
      console.error("Kunde inte skicka meddelande", err);
      alert("Något gick fel när meddelandet skulle skickas.");
    } finally {
      setIsSending(false);
    }
  };

  if (!chatGlobalOpen || !user) return null;

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      {isOpen && (
        <div style={{ 
          width: '320px', 
          height: '400px', 
          background: 'var(--surface-color)', 
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
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Kundservice</h3>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={sendMessage} style={{ padding: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Skriv ett meddelande..." 
              style={{ flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
            <button 
              type="submit" 
              disabled={isSending || !inputText.trim()}
              style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ➤
            </button>
          </form>
        </div>
      )}

      {/* The Bubble Button */}
      {!isOpen && (
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
      )}
    </div>
  );
}
