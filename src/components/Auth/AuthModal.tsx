import React, { useState } from 'react';
import { supabase } from '../../supabase';
import { useStore } from '../../store';
import { trackFunnelEvent } from '../../hooks/useFunnelTracker';

export default function AuthModal() {
  const closeAuthModal = useStore(s => s.closeAuthModal);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (isForgotPassword) {
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        setSuccessMsg('Om e-postadressen finns i systemet skickas en återställningslänk inom kort. Kolla även skräpposten!');
        setIsForgotPassword(false);
      } catch (err: unknown) {
        let errMsg = (err instanceof Error ? err.message : String(err)) || 'Kunde inte skicka återställningslänk.';
        if (errMsg.toLowerCase().includes('for security purposes') || errMsg.toLowerCase().includes('rate limit')) {
          errMsg = 'Du försöker för snabbt. Av säkerhetsskäl, vänta en stund och försök igen.';
        }
        setError(errMsg);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Lösenorden matchar inte.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        closeAuthModal();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data?.user?.identities?.length === 0) {
          throw new Error('User already registered');
        }
        
        if (data?.user) {
          const { error: profileError } = await supabase.from('profiles').insert([{ id: data.user.id, email: data.user.email }]);
          if (profileError && profileError.code !== '23505') {
             console.error("Profile creation error:", profileError);
          }
          
          if (data.session) {
            setSuccessMsg('Konto skapat! Molnsynk aktiverad. Du loggas in...');
            setTimeout(closeAuthModal, 1500);
          } else {
            setSuccessMsg('Konto skapat! ✅ Kolla din inkorg (och skräppost) för att bekräfta din e-postadress, logga sedan in.');
          }
        }
      }
    } catch (err: unknown) {
      let msg = (err instanceof Error ? err.message : String(err)) || 'Ett fel uppstod';
      if (msg === 'Invalid login credentials') msg = 'Fel e-postadress eller lösenord.';
      if (msg === 'User already registered') msg = 'E-postadressen används redan av ett annat konto.';
      if (msg.includes('User is banned') || msg.toLowerCase().includes('banned')) msg = 'Ditt konto är blockerat av en administratör.';
      if (msg.includes('Password should be at least')) msg = 'Lösenordet måste vara minst 6 tecken långt.';
      if (msg.includes('Email not confirmed')) msg = 'Du måste bekräfta din e-postadress. Kolla inkorgen!';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('for security purposes')) {
        msg = 'Du försöker för snabbt. Av säkerhetsskäl, vänta en stund och försök igen.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 15, 25, 0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '1rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{ 
        background: 'var(--surface-color)', 
        border: '1px solid var(--border-color)', 
        borderRadius: '16px', 
        padding: '2.5rem', 
        maxWidth: '450px', 
        width: '100%', 
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        position: 'relative'
      }}>
        <button 
          onClick={closeAuthModal}
          style={{
            position: 'absolute', top: '15px', right: '20px',
            background: 'transparent', border: 'none',
            color: 'var(--text-secondary)', fontSize: '1.5rem',
            cursor: 'pointer'
          }}
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            <span style={{ 
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
              color: 'white', width: '32px', height: '32px', 
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}>E</span>
            SmartEkonomi
          </div>
          <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem' }}>
            {isForgotPassword ? 'Återställ Lösenord' : isLogin ? 'Logga in' : 'Spara din ekonomi'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            {isForgotPassword 
              ? 'Fyll i din e-post så skickar vi en länk'
              : isLogin 
                ? 'Fortsätt till ditt hushåll.' 
                : 'Skapa ett konto för att låsa upp hela appen och spara dina uppgifter. 14 dagar gratis.'}
          </p>
        </div>

        {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}
        {successMsg && <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{successMsg}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>E-postadress</label>
            <input 
              type="email" 
              placeholder="namn@exempel.se" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1rem' }}
            />
          </div>

          {!isForgotPassword && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Lösenord</label>
                {isLogin && (
                  <button 
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setError(''); setSuccessMsg(''); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
                  >
                    Glömt lösenord?
                  </button>
                )}
              </div>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1rem' }}
              />
            </div>
          )}

          {!isLogin && !isForgotPassword && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Bekräfta lösenord</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1rem' }}
              />
            </div>
          )}

          <button type="submit" disabled={loading} style={{ 
            width: '100%', padding: '1rem', marginTop: '0.5rem',
            background: 'var(--accent-gradient)', color: '#fff', 
            border: 'none', borderRadius: '8px', cursor: 'pointer', 
            fontWeight: 'bold', fontSize: '1.1rem',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
          }}>
            {loading 
              ? 'Laddar...' 
              : isForgotPassword 
                ? 'Skicka återställningslänk' 
                : isLogin 
                  ? 'Logga in' 
                  : 'Skapa konto'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <button 
            onClick={() => { 
              if (isForgotPassword) {
                setIsForgotPassword(false);
              } else {
                setIsLogin(!isLogin);
                if (isLogin) trackFunnelEvent('register_start', { source: 'auth_modal' });
              }
              setError(''); 
              setSuccessMsg(''); 
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.95rem', cursor: 'pointer' }}
          >
            {isForgotPassword 
              ? 'Tillbaka till inloggning' 
              : isLogin 
                ? <>Har du inget konto? <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>Skapa ett konto här</span></> 
                : <>Har du redan ett konto? <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>Logga in här</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}
