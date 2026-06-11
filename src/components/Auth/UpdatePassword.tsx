import React, { useState } from 'react';
import { supabase } from '../../supabase';
import { useAuth } from '../../AuthContext';
import Footer from '../Footer';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const { setIsRecoveringPassword } = useAuth();

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
    }
  ];

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Lösenorden matchar inte.');
      return;
    }
    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      setSuccess(true);
      setTimeout(() => {
        setIsRecoveringPassword(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Kunde inte uppdatera lösenordet.');
    } finally {
      setLoading(false);
    }
  };

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
            <h2>Välj nytt lösenord</h2>
            <p>Ange ett nytt, säkert lösenord för ditt konto</p>
          </div>

          {success ? (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <div style={{ color: '#4ade80', padding: '1rem', backgroundColor: 'rgba(74, 222, 128, 0.1)', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 'bold' }}>
                Lösenordet har uppdaterats!
              </div>
              <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Du loggas nu in och skickas vidare till appen...</p>
            </div>
          ) : (
            <form onSubmit={handleUpdate} className="login-form">
              {error && <div className="error-message">{error}</div>}
              
              <div className="input-group">
                <label>Nytt lösenord</label>
                <input 
                  type="password" 
                  placeholder="Minst 6 tecken" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="input-group">
                <label>Bekräfta lösenord</label>
                <input 
                  type="password" 
                  placeholder="Minst 6 tecken" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="submit-btn" style={{ marginTop: '1rem' }}>
                {loading ? <span className="spinner-border"></span> : 'Spara nytt lösenord'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
