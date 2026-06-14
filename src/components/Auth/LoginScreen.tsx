import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { useStore } from '../../store';
import Footer from '../Footer';

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
      desc: "Samla alla hushållets räkningar på ett ställe. SmartEkonomi räknar automatiskt ut exakt hur mycket varje person ska betala och föra över till kontot."
    },
    {
      icon: "💰",
      title: "Privat ekonomi",
      desc: "Få koll på dina egna utgifter i en privat vy som inte påverkar den gemensamma ekonomin. Se direkt vilka kostnader du kan minska för att spara mer pengar."
    },
    {
      icon: "📈",
      title: "Statistik",
      desc: "Följ hushållets ekonomi över tid med tydliga grafer och insikter. Se hur kostnaderna förändras och upptäck var pengarna tar vägen."
    },
    {
      icon: "💎",
      title: "Prova gratis i 14 dagar",
      desc: "Skapa ett konto på några minuter och se hur mycket tid och pengar hushållet kan spara redan första månaden."
    }
  ];

  return (
    <div className="login-wrapper">
      {/* Vänster sida: Info och Features */}
      <div className="login-info-section">
        <div className="login-info-content">
          <div className="brand-badge">Premium Economy</div>
          <h1 className="login-hero-title">
            Släng miniräknaren. <br/>
            <span className="text-gradient">Spara tid och pengar varje månad.</span>
          </h1>
          <p className="login-hero-subtitle">
            SmartEkonomi hjälper dig att få full koll på den gemensamma ekonomin utan Excel, miniräknare eller onödiga diskussioner.
          </p>

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

          <div style={{ marginTop: '3rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 600 }}>Därför använder hushåll SmartEkonomi</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Slipper miniräknaren</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Slipper Excel</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Slipper diskussioner om vem som ska betala vad</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Full kontroll över hushållets ekonomi</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Tydlig statistik över tid</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>✅</span> Fungerar för både gemensam och privat ekonomi</li>
            </ul>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <Footer />
          </div>
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
            <h2>{isForgotPassword ? 'Återställ Lösenord' : isLogin ? 'Välkommen tillbaka' : 'Skapa ditt konto'}</h2>
            <p>
              {isForgotPassword 
                ? 'Fyll i din e-post så skickar vi en länk'
                : isLogin 
                  ? 'Logga in för att fortsätta till ditt hushåll' 
                  : 'Kom igång på 30 sekunder och slipp excel-arken.'}
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

            <button type="submit" disabled={loading} className="submit-btn">
              {loading 
                ? <span className="spinner-border"></span> 
                : isForgotPassword 
                  ? 'Skicka återställningslänk' 
                  : isLogin 
                    ? 'Logga in' 
                    : 'Skapa konto'}
            </button>
          </form>

          {demoEnabled && !isForgotPassword && (
            <div style={{ marginTop: '1rem' }}>
              <button 
                onClick={startDemo}
                type="button"
                style={{ 
                  width: '100%', 
                  padding: '1rem', 
                  background: 'transparent', 
                  border: '1px solid #f43f5e', 
                  color: '#f43f5e', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                🛠️ Testkör appen i Demoläge
              </button>
            </div>
          )}

          <div className="login-footer">
            <button 
              onClick={() => { 
                if (isForgotPassword) {
                  setIsForgotPassword(false);
                } else {
                  setIsLogin(!isLogin); 
                }
                setError(''); 
                setSuccessMsg(''); 
              }}
              className="toggle-auth-btn"
            >
              {isForgotPassword 
                ? 'Tillbaka till inloggning' 
                : isLogin 
                  ? <>Har du inget konto? <span>Skapa ett gratis här</span></> 
                  : <>Har du redan ett konto? <span>Logga in</span></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
