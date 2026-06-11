import React, { useState } from 'react';
import { supabase } from '../../supabase';
import { useAuth } from '../../AuthContext';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const { setIsRecoveringPassword } = useAuth();

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
    <div className="login-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem' }}>
      <div className="login-form-container" style={{ width: '100%', maxWidth: '400px', backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        <h2 style={{ color: 'white', marginBottom: '1rem', textAlign: 'center' }}>Välj nytt lösenord</h2>
        
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#4ade80', padding: '1rem', backgroundColor: 'rgba(74, 222, 128, 0.1)', borderRadius: '8px', marginBottom: '1.5rem' }}>
              Lösenordet har uppdaterats!
            </div>
            <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Du skickas nu vidare till appen...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {error && <div className="error-message" style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}>{error}</div>}
            
            <div className="input-group">
              <label style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.4rem', display: 'block' }}>Nytt lösenord</label>
              <input 
                type="password" 
                placeholder="Minst 6 tecken" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#000', color: '#fff' }}
              />
            </div>
            
            <div className="input-group">
              <label style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.4rem', display: 'block' }}>Bekräfta lösenord</label>
              <input 
                type="password" 
                placeholder="Minst 6 tecken" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#000', color: '#fff' }}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              style={{ width: '100%', padding: '1rem', borderRadius: '8px', backgroundColor: '#a855f7', color: 'white', border: 'none', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem' }}
            >
              {loading ? <span className="spinner-border"></span> : 'Spara nytt lösenord'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
