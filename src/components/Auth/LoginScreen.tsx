import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { useStore } from '../../store';
import Footer from '../Footer';
import { trackFunnelEvent } from '../../hooks/useFunnelTracker';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [demoEnabled, setDemoEnabled] = useState(false);
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
    
    const fetchDemoSettings = async () => {
      try {
        const { data } = await supabase.from('global_settings').select('value').eq('key', 'login_demo_enabled').maybeSingle();
        if (data && data.value === 'true') {
          setDemoEnabled(true);
        }
      } catch (e) {
        console.error("Could not fetch demo settings", e);
      }
    };
    fetchDemoSettings();

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
      {/* Top Header Section */}
      <div className="login-header-section">
        <div className="brand-badge">🏠 SmartEkonomi</div>
        <h1 className="login-hero-title">
          SmartEkonomi – <span className="text-gradient">En smart ekonomi-app för hushållet</span>
          <span style={{ display: 'inline-block', marginLeft: '2.5rem', verticalAlign: 'middle' }}>
            <button 
              onClick={() => {
                trackFunnelEvent('demo_start', { source: 'login_button' });
                startDemo();
              }}
              style={{ 
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', 
                color: '#fff', border: 'none', padding: '0.6rem 1rem', 
                borderRadius: '8px', fontSize: '0.95rem', fontWeight: 'bold', 
                cursor: 'pointer', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                whiteSpace: 'nowrap'
              }}
            >
              🚀 Testa Live-Demon
            </button>
          </span>
        </h1>
        <p className="login-hero-subtitle">
          <span style={{ color: '#fff', fontWeight: 600 }}>Slipp miniräknaren och få full kontroll över ekonomin.</span><br/>
          Vi räknar automatiskt ut vem som ska betala vad, samtidigt som ni håller er privata ekonomi separat.
        </p>
      </div>

      {/* Split Middle Section */}
      <div className="login-split-wrapper">
        <div className="login-left-features">
          
          <div className="features-grid">
            {features.map((feature, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <div>
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-desc">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Höger sida: Formulär */}
        <div className="login-form-section">
          <div className="login-form-container">
            <div className="login-form-header">
              <div className="login-logo">
                <span className="logo-icon">E</span>
                SmartEkonomi
              </div>
              <h2>{isForgotPassword ? 'Återställ Lösenord' : isLogin ? 'Logga in' : 'Skapa gratis konto'}</h2>
              <p>
                {isForgotPassword 
                  ? 'Fyll i din e-post så skickar vi en länk'
                  : isLogin 
                    ? 'Fortsätt till ditt hushåll.' 
                    : 'Helt gratis.'}
              </p>
            </div>

            {error && <div className="login-alert error">{error}</div>}
            {successMsg && <div className="login-alert success">{successMsg}</div>}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="input-group">
                <label>E-postadress</label>
                <input 
                  type="email" 
                  placeholder="namn@exempel.se" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {!isForgotPassword && (
                <div className="input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Lösenord</label>
                    {isLogin && (
                      <button 
                        type="button"
                        onClick={() => { setIsForgotPassword(true); setError(''); setSuccessMsg(''); }}
                        className="forgot-password-link"
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
                  />
                </div>
              )}

              {!isLogin && !isForgotPassword && (
                <div className="input-group">
                  <label>Bekräfta lösenord</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              <button 
                type="submit" 
                className="submit-btn" 
                disabled={loading}
              >
                {loading ? 'Vänta...' : isForgotPassword ? 'Skicka återställningslänk' : isLogin ? 'Logga in' : 'Skapa gratis konto'}
              </button>
            </form>

            {demoEnabled && !isForgotPassword && (
              <div style={{ marginTop: '1rem' }}>
                <button 
                  onClick={() => {
                    trackFunnelEvent('demo_start', { source: 'login_button' });
                    startDemo();
                  }}
                  type="button"
                  style={{ 
                    width: '100%', 
                    padding: '1rem', 
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', 
                    border: 'none', 
                    color: '#fff', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  🛠️ Testa appen i Demoläge
                </button>
              </div>
            )}

            <div className="auth-switch" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              {isForgotPassword ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Kommer du ihåg lösenordet? <button type="button" onClick={() => { setIsForgotPassword(false); setIsLogin(true); setError(''); setSuccessMsg(''); }} style={{ background: 'none', border: 'none', color: '#6366f1', padding: 0, cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}>Logga in här</button>
                </p>
              ) : isLogin ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ position: 'relative', textAlign: 'center', margin: '0.5rem 0' }}>
                    <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.1)' }}></div>
                    <span style={{ position: 'relative', background: '#0f172a', padding: '0 10px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>eller</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => { setIsLogin(false); setError(''); setSuccessMsg(''); }}
                    style={{ 
                      width: '100%', padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', 
                      border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', 
                      borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', 
                      fontSize: '1rem', transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                  >
                    Skapa gratis konto
                  </button>
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '1rem' }}>
                  Har du redan ett konto? <button type="button" onClick={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }} style={{ background: 'none', border: 'none', color: '#6366f1', padding: 0, cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}>Logga in här</button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Section (FAQ and Benefits) */}
      <div className="login-footer-section">
        <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 600 }}>Varför hushåll väljer SmartEkonomi</h3>
          <ul className="benefits-grid">
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Automatisk uppdelning av hushållets kostnader</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Separat hantering av gemensam och privat ekonomi</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Smart bank-import som automatiskt upptäcker utgifter och lön</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Slipper manuella uträkningar och tjafs</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Statistik som visar hur ekonomin utvecklas över tid</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Fungerar för hela hushållet i en gemensam app</li>
          </ul>
        </div>

        <div>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Vanliga frågor (FAQ)</h2>
          <div className="faq-grid">
            <div className="faq-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>Varför behöver vi en ekonomi-app för hushållet?</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>Att ha en delad ekonomi kan leda till onödiga diskussioner och stress om vem som betalat vad. Med en dedikerad ekonomi-app för hushållet automatiseras alla uträkningar. Ni får stenkoll på er gemensamma budget, sparar tid och kan fokusera på roligare saker.</p>
            </div>
            <div className="faq-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>Fungerar er budget-app för både sambor och familjer?</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>Ja, absolut! SmartEkonomi är designad för att vara flexibel. Oavsett om ni är ett nytt sambopar som precis flyttat ihop eller en stor familj med komplexa utgifter, anpassar sig vår budget-app efter era specifika behov för en rättvis delad ekonomi.</p>
            </div>
            <div className="faq-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>Kan vi hantera både gemensam och privat ekonomi?</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>Ja, i vår ekonomi-app kan du enkelt separera dina privata utgifter från de gemensamma. Detta betyder att ni kan ha 100% transparens kring hushållets gemensamma räkningar, samtidigt som var och en behåller full kontroll över sin egen privata ekonomi och budget.</p>
            </div>
            <div className="faq-card">
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
  );
}
