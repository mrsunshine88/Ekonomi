import { createPortal } from 'react-dom';

interface Props {
  onClose: () => void;
}

export default function SubscriptionFeaturesModal({ onClose }: Props) {
  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 15, 25, 0.95)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 100000, padding: '2rem' // Z-index högre än PaywallModal
    }}>
      <div style={{ 
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
          <h2 style={{ color: '#fff', fontSize: '1.5rem', margin: 0 }}>Prenumeration & Fördelar</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '1.25rem', marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
            Endast 59 kr / månad
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '0.75rem', fontStyle: 'italic' }}>
            Mindre än 2 kr per dag för hela hushållet
          </div>
          <div style={{ color: '#10b981', fontSize: '1.1rem', fontWeight: 'bold' }}>
            🎁 Prova gratis i 14 dagar
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: 0 }}>
            Ingen bindningstid. Avsluta när du vill. Priset gäller per hushåll, så hela familjen kan använda appen för en och samma summa.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#e2e8f0', lineHeight: '1.5' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>👥</span>
            <div>
              <strong style={{ color: '#fff' }}>En prenumeration för hela hemmet:</strong> Endast en person i hushållet behöver betala. Resten av familjen bjuds in via en kod och använder appen helt gratis.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚡</span>
            <div>
              <strong style={{ color: '#fff' }}>Automatisk kostnadsfördelning:</strong> Mata in månadens räkningar och låt appen automatiskt räkna ut vem som ska betala vad. Släng miniräknaren och glöm krångliga Excel-ark.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>❤️</span>
            <div>
              <strong style={{ color: '#fff' }}>Mindre ekonomiskt tjafs:</strong> Alla kostnader samlas på ett ställe och systemet räknar automatiskt ut vem som ska betala vad. Ingen behöver hålla reda på siffrorna manuellt.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔔</span>
            <div>
              <strong style={{ color: '#fff' }}>Automatiska Push-påminnelser:</strong> Appen håller koll i bakgrunden och skickar en diskret notis till telefonen när det är dags att pricka av månadens räkningar.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🧠</span>
            <div>
              <strong style={{ color: '#fff' }}>Smart felskrivningskontroll:</strong> Systemet upptäcker ovanligt höga eller låga belopp och varnar om något verkar fel.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            <div>
              <strong style={{ color: '#fff' }}>Statistik:</strong> Följ kostnader över tid, se tydliga trender och exportera till Excel med ett klick.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📱</span>
            <div>
              <strong style={{ color: '#fff' }}>Installera som app på mobilen:</strong> Lägg SmartEkonomi direkt på hemskärmen på Android och iPhone utan att behöva ladda ner från någon appbutik.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔒</span>
            <div>
              <strong style={{ color: '#fff' }}>Helt separerad privat ekonomi:</strong> Hantera dina egna privata utgifter och lån direkt i appen, helt skyddat från den gemensamma Swish-uträkningen. Välj själv om du vill dela en skrivskyddad vy med din partner för total transparens.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🛠️</span>
            <div>
              <strong style={{ color: '#fff' }}>Demoläge:</strong> Testa appen innan du bestämmer dig. Klicka på "Testa Demo" för att utforska alla funktioner med låtsassiffror utan att påverka din riktiga data.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>💬</span>
            <div>
              <strong style={{ color: '#fff' }}>Live-chatt support:</strong> Fastnat på något? Chatta direkt med oss inifrån appen (under öppettider) så hjälper vi dig att komma igång!
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
