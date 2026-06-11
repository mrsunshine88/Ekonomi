import { useState } from 'react';
import { useAuth } from '../AuthContext';

export default function TermsModal() {
  const { acceptTos, tosAccepted, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkedTos, setCheckedTos] = useState(false);
  const [checkedPrivacy, setCheckedPrivacy] = useState(false);
  const [activeTab, setActiveTab] = useState<'tos' | 'privacy'>('tos');

  if (!user || tosAccepted) return null;

  const handleAccept = async () => {
    if (!checkedTos || !checkedPrivacy) return;
    setLoading(true);
    await acceptTos();
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 15, 25, 0.95)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '2rem'
    }}>
      <div style={{ 
        background: 'rgba(30, 41, 59, 0.95)', 
        border: '1px solid rgba(255, 255, 255, 0.1)', 
        borderRadius: '16px', 
        padding: '2rem', 
        maxWidth: '600px', 
        width: '100%', 
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)' 
      }}>
        <h2 style={{ color: '#fff', fontSize: '1.8rem', marginBottom: '1rem', textAlign: 'center' }}>
          Välkommen till Ekonomiappen!
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
          För att fortsätta behöver du läsa och godkänna våra villkor.
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <button 
            onClick={() => setActiveTab('tos')}
            style={{ 
              background: 'transparent', border: 'none', color: activeTab === 'tos' ? '#fff' : 'var(--text-secondary)', 
              fontWeight: activeTab === 'tos' ? 'bold' : 'normal', cursor: 'pointer', padding: '0.5rem',
              borderBottom: activeTab === 'tos' ? '2px solid var(--accent-color)' : '2px solid transparent'
            }}
          >
            Användarvillkor
          </button>
          <button 
            onClick={() => setActiveTab('privacy')}
            style={{ 
              background: 'transparent', border: 'none', color: activeTab === 'privacy' ? '#fff' : 'var(--text-secondary)', 
              fontWeight: activeTab === 'privacy' ? 'bold' : 'normal', cursor: 'pointer', padding: '0.5rem',
              borderBottom: activeTab === 'privacy' ? '2px solid var(--accent-color)' : '2px solid transparent'
            }}
          >
            Integritetspolicy
          </button>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', color: '#ccc', fontSize: '0.95rem', lineHeight: '1.6' }}>
          {activeTab === 'tos' ? (
            <>
              <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Användarvillkor (Terms of Service)</h3>
              <p style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#fff' }}>Ansvarsfriskrivning:</strong> Appen är ett beräkningsverktyg. Vi ansvarar inte för eventuella matematiska fel, buggar eller ekonomiska beslut som fattas baserat på appens data.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Betalning:</strong> Tjänsten kostar 59 kr/månad per hushåll och dras löpande via Stripe tills man avslutar.
              </p>
            </>
          ) : (
            <>
              <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Integritetspolicy (GDPR)</h3>
              <p style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#fff' }}>Vilken data du sparar:</strong> Vi sparar din e-postadress (för inloggning) samt de ekonomiska siffror du själv matar in i appen.
              </p>
              <p style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#fff' }}>Tredjepart:</strong> Betalningsdata hanteras säkert av Stripe. Vi ser eller sparar aldrig dina kortuppgifter på våra servrar.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Rätten att bli glömd:</strong> Du kan när som helst radera ditt konto, vilket källkodsmässigt rensar all din data helt från databasen via vår SQL Cascade-logik.
              </p>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', color: '#fff' }}>
            <input 
              type="checkbox" 
              checked={checkedTos} 
              onChange={e => setCheckedTos(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: 'var(--accent-color)', marginTop: '0.2rem' }}
            />
            <span style={{ fontSize: '0.95rem', lineHeight: '1.4' }}>
              Jag har läst och godkänner <strong>Användarvillkoren</strong>.
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', color: '#fff' }}>
            <input 
              type="checkbox" 
              checked={checkedPrivacy} 
              onChange={e => setCheckedPrivacy(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: 'var(--accent-color)', marginTop: '0.2rem' }}
            />
            <span style={{ fontSize: '0.95rem', lineHeight: '1.4' }}>
              Jag har läst och godkänner <strong>Integritetspolicyn</strong>.
            </span>
          </label>
        </div>

        <button 
          onClick={handleAccept}
          disabled={!checkedTos || !checkedPrivacy || loading}
          style={{ 
            background: (checkedTos && checkedPrivacy) ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.1)', 
            color: (checkedTos && checkedPrivacy) ? '#fff' : 'var(--text-secondary)', 
            padding: '1rem 2rem', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: (checkedTos && checkedPrivacy) ? 'pointer' : 'not-allowed', 
            fontWeight: 'bold', 
            fontSize: '1.1rem', 
            width: '100%',
            transition: 'all 0.2s'
          }}
        >
          {loading ? 'Sparar...' : 'Jag godkänner, ta mig till appen'}
        </button>
      </div>
    </div>
  );
}
