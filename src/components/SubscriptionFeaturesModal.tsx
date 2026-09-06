import { createPortal } from 'react-dom';

interface Props {
  onClose: () => void;
}

export default function SubscriptionFeaturesModal({ onClose }: Props) {
  return createPortal(
    <div 
      onClick={onClose}
      style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 15, 25, 0.95)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 100000, padding: '2rem' // Z-index högre än PaywallModal
    }}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{ 
        background: 'rgba(30, 41, 59, 0.95)', 
        border: '1px solid rgba(16, 185, 129, 0.3)', 
        borderRadius: '16px', 
        padding: '2rem', 
        maxWidth: '550px', 
        width: '100%', 
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.5rem', margin: 0 }}>Appens Fördelar</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '1.25rem', marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
            Helt gratis att använda
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: 0 }}>
            Hela familjen kan använda appen helt gratis. Inga avgifter, ingen bindningstid.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#e2e8f0', lineHeight: '1.5' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>👥</span>
            <div>
              <strong style={{ color: '#fff' }}>Hela hemmet i en app:</strong> Alla i hushållet kan bjudas in via kod och använda appen tillsammans.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚡</span>
            <div>
              <strong style={{ color: '#fff' }}>Automatisk kostnadsfördelning:</strong> Mata in månadens räkningar och låt appen räkna ut hur kostnaderna ska delas automatiskt.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📥</span>
            <div>
              <strong style={{ color: '#fff' }}>Smart Bank-import:</strong> Ladda upp din bankfil. Appen upptäcker automatiskt både utgifter och inkomster (lön) och lär sig för varje månad.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>❤️</span>
            <div>
              <strong style={{ color: '#fff' }}>Mindre ekonomiskt tjafs:</strong> Alla hushållets kostnader samlas på ett ställe och fördelas automatiskt – utan manuella uträkningar.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔔</span>
            <div>
              <strong style={{ color: '#fff' }}>Automatiska påminnelser:</strong> Appen håller koll och skickar notiser när det är dags att hantera räkningar.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🧠</span>
            <div>
              <strong style={{ color: '#fff' }}>Smart kontroll:</strong> Upptäcker ovanliga belopp och varnar om något ser fel ut.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            <div>
              <strong style={{ color: '#fff' }}>Statistik över tid:</strong> Följ kostnader, se trender och exportera till Excel.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📱</span>
            <div>
              <strong style={{ color: '#fff' }}>Installera som app:</strong> Lägg SmartEkonomi direkt på hemskärmen – ingen appbutik behövs.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔒</span>
            <div>
              <strong style={{ color: '#fff' }}>Din privata ekonomi förblir privat:</strong> Dina privata utgifter hålls helt separata från hushållets gemensamma ekonomi. Du kan själv välja om du vill dela en översikt.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🛠️</span>
            <div>
              <strong style={{ color: '#fff' }}>Demoläge:</strong> Testa appen med låtsasdata innan du börjar använda den på riktigt.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>💬</span>
            <div>
              <strong style={{ color: '#fff' }}>Live-chatt support:</strong> Få hjälp direkt i appen via chattbubblan när den är tillgänglig.
            </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          style={{ 
            background: 'rgba(255,255,255,0.1)', 
            color: '#fff', 
            padding: '1rem', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: 'bold', 
            fontSize: '1rem', 
            width: '100%',
            marginTop: '2rem',
            transition: 'all 0.2s'
          }}
        >
          Stäng
        </button>
      </div>
    </div>,
    document.body
  );
}
