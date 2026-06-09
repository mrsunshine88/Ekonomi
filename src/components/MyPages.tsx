import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';

export default function MyPages() {
  const { user, householdId, refreshHousehold } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleJoinHousehold = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    setMsg('');
    try {
      const { data: hh, error: hhErr } = await supabase.from('households').select('id').eq('id', inviteCode.trim()).single();
      if (hhErr || !hh) throw new Error('Kunde inte hitta koden. Är den rättstavad?');

      const { error } = await supabase.from('profiles').update({ household_id: hh.id }).eq('id', user?.id);
      if (error) throw error;

      await refreshHousehold();
      setMsg('✅ Du har gått med i hushållet!');
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHousehold = async () => {
    setLoading(true);
    try {
      const newHouseholdId = crypto.randomUUID();
      
      const { error: hhErr } = await supabase.from('households').insert([{ id: newHouseholdId }]);
      if (hhErr) throw hhErr;

      const { error: profErr } = await supabase.from('profiles').update({ household_id: newHouseholdId }).eq('id', user?.id);
      if (profErr) throw profErr;

      await refreshHousehold();
      setMsg('✅ Molnsynk och delning aktiverat!');
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setMsg('✅ Bekräftelselänk har skickats till både gamla och nya mejlen!');
      setNewEmail('');
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMsg('✅ Lösenordet har ändrats!');
      setNewPassword('');
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => supabase.auth.signOut();

  return (
    <div className="card" style={{ maxWidth: '600px', margin: '0 auto', marginTop: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Mina Sidor</h2>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
        <strong>Inloggad som:</strong> <span style={{ color: 'var(--accent-color)' }}>{user?.email}</span>
      </div>

      {msg && <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '4px solid var(--accent-color)' }}>{msg}</div>}

      <div style={{ marginBottom: '2.5rem', paddingBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>⚙️ Hantera inloggning</h3>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input 
            type="email" 
            placeholder="Ny e-postadress..." 
            value={newEmail} 
            onChange={e => setNewEmail(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />
          <button onClick={handleUpdateEmail} disabled={loading} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Byt Mejladress</button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="password" 
            placeholder="Nytt lösenord..." 
            value={newPassword} 
            onChange={e => setNewPassword(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />
          <button onClick={handleUpdatePassword} disabled={loading} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Byt Lösenord</button>
        </div>
      </div>

      {!householdId ? (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>☁️ Säkra din data i molnet</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Din data sparas just nu bara på den här enheten. Klicka på knappen nedan för att ladda upp din ekonomi till ditt säkra moln. Du får då även en kod om du vill bjuda in din sambo i framtiden.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
            <button onClick={handleCreateHousehold} disabled={loading} style={{ padding: '1rem', background: 'var(--success-color)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Aktivera molnsynk & Skapa inbjudningskod
            </button>
            
            <div style={{ textAlign: 'center', margin: '0.5rem 0', color: 'var(--text-secondary)' }}>eller</div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Klistra in sambons kod..." 
                value={inviteCode} 
                onChange={e => setInviteCode(e.target.value)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
              />
              <button onClick={handleJoinHousehold} disabled={loading} style={{ padding: '0.75rem 1.5rem', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                Gå med
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--success-color)', marginBottom: '0.5rem' }}>✅ Din app är sparad i molnet</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            För att bjuda in din sambo, be dem registrera sig och klistra in koden nedan:
          </p>
          <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <code style={{ color: '#fff', fontSize: '1.1rem', wordBreak: 'break-all', marginRight: '1rem' }}>{householdId}</code>
            <button 
              onClick={() => { navigator.clipboard.writeText(householdId); setMsg('Kopierat till urklipp!'); }}
              style={{ background: 'var(--accent-color)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Kopiera
            </button>
          </div>

          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>👥 Gå med i annans hushåll</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Vill du istället gå med i någon annans ekonomi? Klistra in deras kod här:
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              placeholder="Klistra in sambons kod..." 
              value={inviteCode} 
              onChange={e => setInviteCode(e.target.value)}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
            />
            <button onClick={handleJoinHousehold} disabled={loading} style={{ padding: '0.75rem 1.5rem', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Gå med
            </button>
          </div>
        </div>
      )}

      <button onClick={handleSignOut} style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px solid #f43f5e', color: '#f43f5e', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '2rem' }}>
        Logga ut
      </button>
    </div>
  );
}
