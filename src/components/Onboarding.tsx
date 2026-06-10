import { useState } from 'react';
import { useStore } from '../store';
import { supabase } from '../supabase';

export default function Onboarding() {
  const householdId = useStore(s => s.householdId);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [householdName, setHouseholdName] = useState('');
  const [members, setMembers] = useState([{ name: '' }, { name: '' }]);
  const [hasSharedAccount, setHasSharedAccount] = useState(true);

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
      const accountsToCreate = [];
      if (hasSharedAccount) {
        accountsToCreate.push({ id: crypto.randomUUID(), household_id: householdId, name: householdName || 'Gemensamt konto', type: 'shared', transfer_method: 'transfer' });
      }
      members.forEach((m, i) => {
        if (m.name.trim()) {
          accountsToCreate.push({ id: crypto.randomUUID(), household_id: householdId, name: m.name.trim(), type: 'person', transfer_method: 'swish' });
        }
      });

      if (accountsToCreate.length === 0) {
         // Fallback
         accountsToCreate.push({ id: crypto.randomUUID(), household_id: householdId, name: 'Person 1', type: 'person', transfer_method: 'swish' });
      }

      await supabase.from('accounts').insert(accountsToCreate);
      
      // Force reload state
      window.location.reload();
    } catch (e) {
      console.error(e);
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
            <h2 style={{ color: '#fff', fontSize: '1.8rem', marginBottom: '1rem' }}>Välkommen till Ekonomiappen!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.5' }}>
              Vi ska hjälpa er att aldrig mer behöva bråka om vem som ska betala vad. Låt oss bygga upp ert virtuella kassavalv.
            </p>
            <button 
              onClick={() => setStep(2)}
              style={{ background: 'var(--accent-gradient)', color: 'white', padding: '1rem 2rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', width: '100%' }}
            >
              Kom igång
            </button>
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
