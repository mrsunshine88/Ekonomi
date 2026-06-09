import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useStore } from '../store';
import { supabase } from '../supabase';

export default function MyPages() {
  const { user, householdId, role, refreshHousehold } = useAuth();
  const toggleSharePrivateEconomy = useStore(s => s.toggleSharePrivateEconomy);
  const householdProfiles = useStore(s => s.state.householdProfiles || []);
  const myProfile = householdProfiles.find(p => p.id === user?.id);
  const isSharingPrivate = myProfile?.share_private_economy || false;
  const [members, setMembers] = useState<{id: string, email: string, role: string, created_at?: string}[]>([]);

  useEffect(() => {
    if (householdId) {
      supabase.from('profiles').select('id, email, role, created_at').eq('household_id', householdId).order('created_at', { ascending: true })
        .then(({ data }) => {
          if (data) setMembers(data);
        });
    } else {
      setMembers([]);
    }
  }, [householdId]);

  const handleKickMember = async (memberId: string, memberEmail: string) => {
    if (!window.confirm(`Är du säker på att du vill ta bort ${memberEmail} från hushållet?`)) return;
    setLoading(true);
    try {
      const newHouseholdId = crypto.randomUUID();
      await supabase.from('households').insert([{ id: newHouseholdId }]);
      await supabase.from('profiles').update({ household_id: newHouseholdId, role: 'owner' }).eq('id', memberId);
      
      setMembers(prev => prev.filter(m => m.id !== memberId));
      setMsg(`✅ ${memberEmail} har tagits bort från hushållet.`);
    } catch (e: any) {
      setMsg('❌ Kunde inte ta bort medlem: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
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
      const code = inviteCode.trim();
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(code)) {
         throw new Error('Ogiltigt format på koden.');
      }

      const { error } = await supabase.from('profiles').upsert([{ 
        id: user?.id, 
        email: user?.email, 
        household_id: code, 
        role: 'member' 
      }]);
      
      if (error) {
        if (error.code === '23503') {
          throw new Error('Kunde inte hitta koden. Är den rättstavad?');
        }
        throw error;
      }

      await refreshHousehold();
      setMsg('✅ Du har gått med i hushållet!');
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHousehold = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const newHouseholdId = crypto.randomUUID();
      const { error: hhErr } = await supabase.from('households').insert([{ id: newHouseholdId }]);
      if (hhErr) throw hhErr;
      
      const { error } = await supabase.from('profiles').upsert([{ id: user.id, email: user.email, household_id: newHouseholdId, role: 'owner' }]);
      if (error) throw error;
      
      await refreshHousehold();
      setMsg('✅ Molnsynk och delning aktiverat!');
    } catch (err: any) {
      console.error(err);
      setMsg('❌ Kunde inte skapa molnsynk. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (memberId: string, currentRole: string) => {
    const newRole = currentRole === 'owner' ? 'member' : 'owner';
    setLoading(true);
    try {
      const { error } = await supabase.rpc('set_user_role', { target_user_id: memberId, new_role: newRole });
      if (error) throw error;
      
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setMsg(`✅ Behörighet ändrad! Personen är nu ${newRole === 'owner' ? 'Medägare (full tillgång till gemensamma räkningar)' : 'Medlem (Låst läge)'}.`);
    } catch (e: any) {
      setMsg('❌ ' + e.message + '. (Tips: Kör SQL-skriptet för behörigheter om databasen blockerar)');
    } finally {
      setLoading(false);
    }
  };

  const [currentPassword, setCurrentPassword] = useState('');
  
  const verifyCurrentPassword = async () => {
    if (!user?.email || !currentPassword) {
      throw new Error("Du måste ange ditt nuvarande lösenord för att göra ändringar.");
    }
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (error) throw new Error("Nuvarande lösenord är felaktigt.");
  };

  const handleUpdateEmail = async () => {
    if (!newEmail) return;
    setLoading(true);
    try {
      await verifyCurrentPassword();
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setMsg('✅ Bekräftelselänk har skickats till både gamla och nya mejlen!');
      setNewEmail('');
      setCurrentPassword('');
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
      await verifyCurrentPassword();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMsg('✅ Lösenordet har ändrats!');
      setNewPassword('');
      setCurrentPassword('');
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => supabase.auth.signOut();

  const handleDeleteAccount = async () => {
    if (!window.confirm("Är du HELT säker? Detta kommer radera ditt inlogg, din profil och alla dina privata räkningar för alltid. Detta går inte att ångra.")) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('delete_user');
      if (error) throw error;
      
      await supabase.auth.signOut();
    } catch (e: any) {
      setMsg('❌ ' + e.message);
      setLoading(false);
    }
  };

  const handleToggleShare = async () => {
    const newState = !isSharingPrivate;
    try {
      const dbRow = await toggleSharePrivateEconomy(newState);
      setMsg(`✅ Ändrat! Databasen svarade: share_private_economy=${dbRow.share_private_economy}`);
    } catch (e: any) {
      setMsg('❌ Det gick inte att spara: ' + e.message);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '600px', margin: '0 auto', marginTop: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Mina Sidor</h2>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
        <strong>Inloggad som:</strong> <span style={{ color: 'var(--accent-color)' }}>{user?.email}</span>
      </div>

      {msg && <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '4px solid var(--accent-color)' }}>{msg}</div>}

      {householdId && (
        <div style={{ marginBottom: '2.5rem', paddingBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>🔒 Integritet och Delning</h3>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>Delning av privat ekonomi</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {isSharingPrivate 
                  ? 'Din privata ekonomi är just nu synlig för andra i hushållet.' 
                  : 'Gör så att andra i hushållet kan välja att se dina privata räkningar.'}
              </div>
            </div>
            <button 
              onClick={handleToggleShare}
              style={{ 
                background: isSharingPrivate ? 'transparent' : 'var(--success-color)', 
                color: isSharingPrivate ? '#f43f5e' : '#fff',
                border: isSharingPrivate ? '1px solid #f43f5e' : 'none',
                padding: '0.75rem 1rem', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              }}
            >
              {isSharingPrivate ? 'Sluta dela privat ekonomi' : 'Dela min privata ekonomi'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '2.5rem', paddingBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>⚙️ Hantera inloggning</h3>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          För din säkerhet måste du ange ditt nuvarande lösenord för att byta e-post eller lösenord.
        </p>
        
        <div style={{ marginBottom: '1rem' }}>
          <input 
            type="password" 
            placeholder="Ditt nuvarande lösenord..." 
            value={currentPassword} 
            onChange={e => setCurrentPassword(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />
        </div>

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
            Din data sparas just nu bara på den här enheten. Klicka på knappen nedan för att ladda upp din ekonomi till ditt säkra moln. Du får då även en inbjudningskod om du vill bjuda in fler till hushållet.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
            <button onClick={handleCreateHousehold} disabled={loading} style={{ padding: '1rem', background: 'var(--success-color)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Aktivera molnsynk & Skapa inbjudningskod
            </button>
            
            <div style={{ textAlign: 'center', margin: '0.5rem 0', color: 'var(--text-secondary)' }}>eller</div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Klistra in inbjudningskod..." 
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
          {role === 'owner' && (
            <>
              <h3 style={{ color: 'var(--success-color)', marginBottom: '0.5rem' }}>✅ Hushållet är sparat i molnet</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                För att bjuda in en medlem, be personen registrera ett eget konto och sedan ange koden nedan:
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
            </>
          )}

          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', marginTop: '1.5rem' }}>👥 Hushållets medlemmar</h3>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden' }}>
            {members.map((m, index) => {
              const isFounder = index === 0;
              return (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ color: '#fff' }}>{m.email} {m.id === user?.id && '(Du)'} {isFounder && '👑 (Grundare)'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.role === 'owner' ? 'Medägare' : 'Medlem'}</div>
                </div>
                {role === 'owner' && m.id !== user?.id && !isFounder && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => handleToggleRole(m.id, m.role)}
                      disabled={loading}
                      style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      {m.role === 'owner' ? 'Lås läge (Gör till Medlem)' : 'Lås upp (Gör till Medägare)'}
                    </button>
                    <button 
                      onClick={() => handleKickMember(m.id, m.email)}
                      disabled={loading}
                      style={{ background: '#f43f5e', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Kicka ut
                    </button>
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
        <h3 style={{ color: '#f43f5e', marginBottom: '0.5rem' }}>Farlig zon</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Dessa åtgärder kan inte ångras.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {householdId && (
            <button 
              onClick={() => {
                if(window.confirm('Är du säker på att du vill lämna hushållet? Du får då en helt tom app för dig själv.')) {
                  handleCreateHousehold();
                }
              }} 
              disabled={loading} 
              style={{ padding: '0.75rem 1rem', background: 'transparent', color: '#f43f5e', border: '1px solid #f43f5e', borderRadius: '8px', cursor: 'pointer' }}
            >
              🚪 Lämna och skapa eget hushåll
            </button>
          )}

          <button 
            onClick={handleDeleteAccount} 
            disabled={loading} 
            style={{ padding: '0.75rem 1rem', background: '#f43f5e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            🗑️ Radera mitt konto för alltid
          </button>
        </div>
      </div>

      <button onClick={handleSignOut} style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '2rem' }}>
        Logga ut
      </button>
    </div>
  );
}
