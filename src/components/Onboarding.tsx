import { useState } from 'react';
import { useStore } from '../store';
import { supabase } from '../supabase';

export default function Onboarding() {
  const householdId = useStore(s => s.householdId);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [householdName, setHouseholdName] = useState('');
  const [members, setMembers] = useState([{ name: '' }, { name: '' }]);
  const [hasSharedAccount] = useState(true);
  
  // Join logic
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  const handleJoin = async () => {
    if (!inviteCode) return;
    setJoinLoading(true);
    setJoinError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Inte inloggad.");

      const { data: hhData, error: hhErr } = await supabase.from('households').select('id').eq('id', inviteCode).single();
      if (hhErr || !hhData) throw new Error("Kunde inte hitta ett hushåll med den koden.");
      
      const { error } = await supabase.from('profiles').upsert([{ id: user.id, email: user.email, household_id: inviteCode, role: 'member' }]);
      if (error) throw error;
      
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setJoinError('❌ ' + err.message);
    } finally {
      setJoinLoading(false);
    }
  };

  const handleAddMember = () => setMembers([...members, { name: '' }]);
  const handleRemoveMember = (i: number) => setMembers(members.filter((_, index) => index !== i));
  const updateMember = (i: number, val: string) => {
    const newM = [...members];
    newM[i].name = val;
    setMembers(newM);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Inte inloggad");

      // 1. Skapa hushållet
      const newHouseholdId = crypto.randomUUID();
      const { error: hhErr } = await supabase.from('households').insert([{ id: newHouseholdId, name: householdName || 'Mitt hushåll' }]);
      if (hhErr) throw hhErr;

      // 2. Skapa inställningar för hushållet med rätt defaults (endast totalsumma, ej swish/överföringar)
      await supabase.from('household_settings').insert([{
        household_id: newHouseholdId,
        show_summary: true,
        show_swish_summary: false,
        show_transfer_summary: false,
        enable_management_buttons: true,
        show_top_total: true,
        show_private_top_total: true
      }]);

      // 3. Koppla profilen till hushållet
      const { error: profErr } = await supabase.from('profiles').update({ household_id: newHouseholdId, role: 'owner' }).eq('id', user.id);
      if (profErr) throw profErr;

      // 4. Skapa konton
      const accountsToCreate = [];
      if (hasSharedAccount) {
        accountsToCreate.push({ id: crypto.randomUUID(), household_id: newHouseholdId, name: householdName || 'Gemensamt konto', type: 'shared', transfer_method: 'transfer' });
      }
      members.forEach((m) => {
        if (m.name.trim()) {
          accountsToCreate.push({ id: crypto.randomUUID(), household_id: newHouseholdId, name: m.name.trim(), type: 'person', transfer_method: 'swish' });
        }
      });

      if (accountsToCreate.length === 0) {
         accountsToCreate.push({ id: crypto.randomUUID(), household_id: newHouseholdId, name: 'Person 1', type: 'person', transfer_method: 'swish' });
      }

      await supabase.from('accounts').insert(accountsToCreate);
      
      // Force reload state
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Ett fel uppstod");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 15, 25, 0.95)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '2rem', textAlign: 'center'
    }}>
      <div style={{ 
        background: 'rgba(30, 41, 59, 0.9)', 
        border: '1px solid rgba(255, 255, 255, 0.1)', 
        borderRadius: '16px', 
        padding: '3rem 2rem', 
        maxWidth: '500px', 
        width: '100%', 
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)' 
      }}>
        {step === 1 && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👋</div>
            <h2 style={{ color: '#fff', fontSize: '1.8rem', marginBottom: '1rem' }}>Välkommen till SmartEkonomi!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.5' }}>
              Låt oss bygga upp ert virtuella kassavalv och slippa bråka om vem som ska betala vad.
            </p>
            <button 
              onClick={() => setStep(2)}
              style={{ background: 'var(--accent-gradient)', color: 'white', padding: '1rem 2rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', width: '100%', marginBottom: '2rem' }}
            >
              Skapa nytt hushåll
            </button>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem', marginTop: '1rem' }}>
              <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1rem' }}>Har du blivit inbjuden?</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                Klistra in inbjudningskoden från hushållets grundare för att ansluta (du behöver då inte betala).
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Klistra in inbjudningskod..." 
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                />
                <button 
                  onClick={handleJoin}
                  disabled={joinLoading}
                  style={{ background: 'var(--accent-color)', color: '#fff', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {joinLoading ? '...' : 'Gå med'}
                </button>
              </div>
              {joinError && <p style={{ color: 'var(--danger-color)', marginTop: '1rem', fontSize: '0.9rem' }}>{joinError}</p>}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '1rem' }}>Vad heter ert hushåll?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>Detta blir namnet på ert gemensamma konto.</p>
            <input 
              type="text" 
              placeholder="T.ex. ICA-kortet, Gemensamma, Huset..." 
              value={householdName}
              onChange={e => setHouseholdName(e.target.value)}
              style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '1.1rem', marginBottom: '2rem' }}
            />
            <button 
              onClick={() => setStep(3)}
              style={{ background: 'var(--accent-gradient)', color: 'white', padding: '1rem 2rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', width: '100%' }}
            >
              Nästa
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '1rem' }}>Vilka är med i hushållet?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem', textAlign: 'left' }}>
              {members.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder={`Person ${i + 1}`} 
                    value={m.name}
                    onChange={e => updateMember(i, e.target.value)}
                    style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '1.1rem' }}
                  />
                  {members.length > 2 && (
                    <button onClick={() => handleRemoveMember(i)} style={{ padding: '0 1rem', background: 'transparent', color: '#f43f5e', border: '1px solid #f43f5e', borderRadius: '8px', cursor: 'pointer' }}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={handleAddMember} style={{ padding: '0.75rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px dashed var(--text-secondary)', borderRadius: '8px', cursor: 'pointer' }}>+ Lägg till person</button>
            </div>
            <button 
              onClick={handleFinish}
              disabled={loading}
              style={{ background: 'var(--success-color)', color: 'white', padding: '1rem 2rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', width: '100%' }}
            >
              {loading ? 'Skapar hushåll...' : 'Spara och gå till appen'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
