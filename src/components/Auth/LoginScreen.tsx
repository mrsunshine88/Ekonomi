import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
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
        const { data: isConfirmed, error: rpcError } = await supabase.rpc('check_email_confirmed', { check_email: email });
        
        if (rpcError) throw rpcError;
        if (!isConfirmed) {
           throw new Error("Kunde inte hitta ett bekräftat konto med den e-postadressen. Har du klickat på länken i bekräftelsemejlet?");
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        setSuccessMsg('En återställningslänk har skickats till din e-post. Kolla även skräpposten!');
        setIsForgotPassword(false);
      } catch (err: any) {
        let errMsg = err.message || 'Kunde inte skicka återställningslänk.';
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
    } catch (err: any) {
      let msg = err.message || 'Ett fel uppstod';
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
      icon: "⚡",
      title: "Splitwise-matematik i realtid",
      desc: "Mata in månadens räkningar och låt vår motor räkna ut nettobeloppet på en bråkdel av en sekund. Släng miniräknaren och glöm krångliga Excel-ark."
    },
    {
      icon: "👥",
      title: "En prenumeration för hela hemmet",
      desc: "Endast en person behöver betala. Resten av familjen bjuds in via en kod och använder appen helt gratis."
    },
    {
      icon: "🔔",
      title: "Automatiska Push-påminnelser",
      desc: "Appen håller koll i bakgrunden och skickar en diskret notis till telefonen när det är dags att pricka av månadens räkningar."
    },
    {
      icon: "🧠",
      title: "Smart felskrivningskontroll",
      desc: "Vårt system analyserar er historik och varnar direkt om du råkar trycka in en nolla för mycket på elräkningen."
    },
    {
      icon: "📊",
      title: "EkonomiTB",
      desc: "Följ dina kostnader bakåt i historik och få full insyn med interaktiv statistik."
    },
    {
      icon: "💬",
      title: "Live-support & Demoläge",
      desc: "Testkör appen säkert med låtsassiffror. Fastnar du? Chatta direkt med oss i appen så hjälper vi till."
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
            <span className="text-gradient">Vi löser hushållsekonomin.</span>
          </h1>
          <p className="login-hero-subtitle">
            Den smartaste plattformen för att automatisera, dela och räkna ut månadens utgifter för hela ditt hushåll – oavsett om ni är två eller du kör själv.
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
