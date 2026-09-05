import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { useStore } from '../../store';
import Footer from '../Footer';
import { trackFunnelEvent } from '../../hooks/useFunnelTracker';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const startDemo = useStore(s => s.startDemo);

  // Öppna register-fliken direkt om vi kom från demo-bannern
  useEffect(() => {
    if (localStorage.getItem('smartEkonomi_openRegister') === 'true') {
      localStorage.removeItem('smartEkonomi_openRegister');
      setIsLogin(false);
      trackFunnelEvent('register_start', { source: 'demo_banner' });
    }
  }, []);

  // Sätt body background endast på login screen om vi behöver override
  useEffect(() => {
    document.body.style.background = '#060913';

    return () => {
      document.body.style.background = '#0b0f19';
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (isForgotPassword) {
      setLoading(true);
      try {
        // SÄKERT MÖNSTER: Vi anropar Supabase direkt utan att kolla om e-posten finns.
        // Detta förhindrar "user enumeration" — ingen utomstående kan lista vilka konton som existerar.
        // Supabase skickar bara ett mail om kontot finns, annars händer ingenting (men vi visar alltid samma meddelande).
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
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data?.user?.identities?.length === 0) {
          throw new Error('User already registered');
        }
        
        if (data?.user) {
          // Skapa profil - VIKTIGT: invänta att detta blir klart innan vi visar success-meddelande
          const { error: profileError } = await supabase.from('profiles').insert([{ id: data.user.id, email: data.user.email }]);
          if (profileError && profileError.code !== '23505') {
             console.error("Profile creation error:", profileError);
          }
          
          if (data.session) {
            setSuccessMsg('Konto skapat! Molnsynk aktiverad. Du loggas in...');
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

  const features = [
    {
      icon: "🏠",
      title: "Gemensam ekonomi",
      desc: "Samla alla hushållets räkningar på ett ställe. Räknar automatiskt ut varje persons andel av hushållets kostnader."
    },
    {
      icon: "💰",
      title: "Privat ekonomi",
      desc: "Få koll på dina egna utgifter separat från hushållets ekonomi."
    },
    {
      icon: "📈",
      title: "Statistik",
      desc: "Följ hushållets ekonomi över tid med tydliga grafer och insikter. Se hur kostnaderna förändras och upptäck var pengarna tar vägen."
    },
    {
      icon: "⚡",
      title: "Smart Bank-import",
      desc: "Ladda upp din bankfil så sorterar systemet automatiskt in både räkningar och inkomster. Botemedlet mot Tomt Konto-syndromet!"
    },
    {
      icon: "💎",
      title: "Helt gratis att använda",
      desc: "Skapa ett gratis konto på några minuter och upptäck hur enkelt det kan vara att hålla koll på ekonomin."
    }
  ];

  return (
    <div className="login-wrapper">
      {/* Vänster sida: Info och Features */}
      <div className="login-info-section">
        <div className="login-info-content">
          <div className="brand-badge">🏠 SmartEkonomi</div>
          <h1 className="login-hero-title" style={{ fontSize: '2.5rem', lineHeight: '1.2' }}>
            SmartEkonomi – <span className="text-gradient">En smart ekonomi-app för hushållet</span>
          </h1>
          <p className="login-hero-subtitle" style={{ lineHeight: '1.6' }}>
            <span style={{ color: '#fff', fontWeight: 600 }}>Slipp miniräknaren.</span> <span className="text-gradient" style={{ fontWeight: 600 }}>Spara tid och få full kontroll över hushållets ekonomi.</span><br/><br/>
            SmartEkonomi är en ny ekonomi-app som automatiskt räknar ut vem som ska betala vad, håller er privata ekonomi separat och visar hur era kostnader utvecklas över tid. Perfekt för sambor och familjer som vill ha en smidig budget-app för en rättvis delad ekonomi.
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button 
              onClick={() => {
                trackFunnelEvent('demo_start', { source: 'login_button' });
                startDemo();
              }}
              style={{ 
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', 
                color: '#fff', border: 'none', padding: '1.2rem 2.5rem', 
                borderRadius: '12px', fontSize: '1.2rem', fontWeight: 'bold', 
                cursor: 'pointer', boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)',
                animation: 'pulse 2s infinite', display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}
            >
              🚀 Testa Live-Demon
            </button>
          </div>

          <div className="features-grid" style={{ marginTop: '3rem' }}>
            {features.map((feature, i) => (
              <div key={i} className="feature-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem', transition: 'transform 0.2s', cursor: 'default' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div className="feature-icon" style={{ fontSize: '2rem', marginBottom: '1rem' }}>{feature.icon}</div>
                <div>
                  <h3 className="feature-title" style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#fff' }}>{feature.title}</h3>
                  <p className="feature-desc" style={{ color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '3rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 600 }}>Varför hushåll väljer SmartEkonomi</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Automatisk uppdelning av hushållets kostnader</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Separat hantering av gemensam och privat ekonomi</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Smart bank-import som automatiskt upptäcker utgifter och lön</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Slipper manuella uträkningar och tjafs</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Statistik som visar hur ekonomin utvecklas över tid</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Fungerar för hela hushållet i en gemensam app</li>
            </ul>
          </div>

          <div style={{ marginTop: '3rem', padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Vanliga frågor (FAQ)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>Varför behöver vi en ekonomi-app för hushållet?</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>Att ha en delad ekonomi kan leda till onödiga diskussioner och stress om vem som betalat vad. Med en dedikerad ekonomi-app för hushållet automatiseras alla uträkningar. Ni får stenkoll på er gemensamma budget, sparar tid och kan fokusera på roligare saker.</p>
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>Fungerar er budget-app för både sambor och familjer?</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>Ja, absolut! SmartEkonomi är designad för att vara flexibel. Oavsett om ni är ett nytt sambopar som precis flyttat ihop eller en stor familj med komplexa utgifter, anpassar sig vår budget-app efter era specifika behov för en rättvis delad ekonomi.</p>
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>Kan vi hantera både gemensam och privat ekonomi?</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>Ja, i vår ekonomi-app kan du enkelt separera dina privata utgifter från de gemensamma. Detta betyder att ni kan ha 100% transparens kring hushållets gemensamma räkningar, samtidigt som var och en behåller full kontroll över sin egen privata ekonomi och budget.</p>
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>Är det svårt att komma igång med budget-appen?</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>Nej, det tar bara några minuter! Du skapar ett konto och kan sedan enkelt importera utgifter direkt från din bank, eller lägga in dem manuellt. Inga fler krångliga excel-ark – vi gör det smidigt för er.</p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <Footer />
          </div>
        </div>
      </div>

      {/* Höger sida: Formulär */}
      <div className="login-form-section" style={{ position: 'relative' }}>
        {/* Glow effect behind form */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120%', height: '120%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)', zIndex: 0, pointerEvents: 'none' }}></div>
        
        <div className="login-form-container" style={{ 
          background: 'rgba(15, 23, 42, 0.7)', 
          backdropFilter: 'blur(20px)', 
          border: '1px solid rgba(255,255,255,0.1)', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.1)',
          borderRadius: '24px',
          padding: '3rem',
          position: 'relative',
          zIndex: 1
        }}>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '16px' }}>
            <button 
              type="button"
              onClick={() => { setIsLogin(true); setIsForgotPassword(false); setError(''); setSuccessMsg(''); }}
              style={{ flex: 1, padding: '1rem', border: 'none', borderRadius: '12px', background: isLogin && !isForgotPassword ? 'rgba(99, 102, 241, 0.3)' : 'transparent', color: isLogin && !isForgotPassword ? '#fff' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }}
            >
              Logga in
            </button>
            <button 
              type="button"
              onClick={() => { setIsLogin(false); setIsForgotPassword(false); setError(''); setSuccessMsg(''); }}
              style={{ flex: 1, padding: '1rem', border: 'none', borderRadius: '12px', background: !isLogin && !isForgotPassword ? 'rgba(16, 185, 129, 0.3)' : 'transparent', color: !isLogin && !isForgotPassword ? '#fff' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s', position: 'relative' }}
            >
              Skapa konto
              {!isLogin && !isForgotPassword && <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--success-color)', color: '#fff', fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(16,185,129,0.5)' }}>GRATIS</span>}
            </button>
          </div>

          <div className="login-form-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#fff' }}>{isForgotPassword ? 'Återställ Lösenord' : isLogin ? 'Välkommen tillbaka' : 'Kom igång på 10 sekunder'}</h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              {isForgotPassword 
                ? 'Fyll i din e-post så skickar vi en länk'
                : isLogin 
                  ? 'Logga in för att fortsätta till ditt hushåll.' 
                  : 'Skapa ett konto för hela hushållet helt gratis.'}
            </p>
          </div>

          {error && <div className="login-alert error" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>{error}</div>}
          {successMsg && <div className="login-alert success" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>{successMsg}</div>}

          <form onSubmit={handleSubmit} className="login-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="input-group">
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>E-postadress</label>
              <input 
                type="email" 
                placeholder="namn@exempel.se" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '1.2rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '1rem', outline: 'none', transition: 'border 0.3s' }}
                onFocus={e => e.target.style.border = '1px solid var(--accent-color)'}
                onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.1)'}
              />
            </div>

            {!isForgotPassword && (
              <div className="input-group">
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
                  style={{ width: '100%', padding: '1.2rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '1rem', outline: 'none', transition: 'border 0.3s' }}
                  onFocus={e => e.target.style.border = '1px solid var(--accent-color)'}
                  onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.1)'}
                />
              </div>
            )}

            {!isLogin && !isForgotPassword && (
              <div className="input-group">
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>Bekräfta lösenord</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '1.2rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '1rem', outline: 'none', transition: 'border 0.3s' }}
                  onFocus={e => e.target.style.border = '1px solid var(--accent-color)'}
                  onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.1)'}
                />
              </div>
            )}

            <button type="submit" disabled={loading} style={{ 
              width: '100%', padding: '1.2rem', marginTop: '1rem',
              background: isLogin ? 'var(--accent-gradient)' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)', 
              color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1.1rem', 
              fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.2s, boxShadow 0.2s',
              boxShadow: isLogin ? '0 8px 25px rgba(99, 102, 241, 0.4)' : '0 8px 25px rgba(16, 185, 129, 0.4)'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {loading 
                ? <span className="spinner-border"></span> 
                : isForgotPassword 
                  ? 'Skicka länk' 
                  : isLogin 
                    ? 'Logga in' 
                    : 'Skapa gratis konto'}
            </button>
          </form>
          
          {isForgotPassword && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button 
                onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMsg(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Tillbaka till inloggning
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
