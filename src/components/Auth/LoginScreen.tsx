import React, { useState } from 'react';
import { supabase } from '../../supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data?.user) {
          // Skapa profil
          const { error: profileError } = await supabase.from('profiles').insert([{ id: data.user.id, email: data.user.email }]);
          if (profileError && profileError.code !== '23505') {
             console.error("Profile creation error:", profileError);
          }
          
          // Skapa ett eget moln-hushåll automatiskt till användaren
          const newHouseholdId = crypto.randomUUID();
          const { error: hhErr } = await supabase.from('households').insert([{ id: newHouseholdId }]);
          if (!hhErr) {
             await supabase.from('profiles').update({ household_id: newHouseholdId }).eq('id', data.user.id);
          }
          
          if (data.session) {
            setSuccessMsg('Konto skapat! Molnsynk aktiverad. Du loggas in...');
          } else {
            setSuccessMsg('Konto skapat! ✅ Kolla din inkorg (och skräppost) för att bekräfta din e-postadress, logga sedan in.');
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ett fel uppstod');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', margin: '0 1rem' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>Ekonomi & Swish</h1>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-secondary)' }}>{isLogin ? 'Logga in' : 'Skapa Konto'}</h2>
        
        {error && <div style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}
        {successMsg && <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{successMsg}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            type="email" 
            placeholder="E-post" 
            value={email} 
            onChange={e => setEmail(e.target.value)}
            required
            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />
          <input 
            type="password" 
            placeholder="Lösenord" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            required
            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{ padding: '0.75rem', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '1rem' }}
          >
            {loading ? 'Laddar...' : isLogin ? 'Logga in' : 'Skapa konto'}
          </button>
        </form>

        <button 
          onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }}
          style={{ width: '100%', marginTop: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {isLogin ? 'Har du inget konto? Skapa ett här' : 'Har du redan ett konto? Logga in'}
        </button>
      </div>
    </div>
  );
}
