import { useStore } from '../store';

export default function DemoBanner() {
  const isDemoMode = useStore(s => s.isDemoMode);
  const stopDemo = useStore(s => s.stopDemo);
  const openAuthModal = useStore(s => s.openAuthModal);

  if (!isDemoMode) return null;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      background: '#facc15', // Yellow warning color
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0.75rem 1rem',
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
      gap: '1.5rem',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontSize: '1rem' }}>
        <span>⚠️</span>
        <span style={{ fontWeight: 800 }}>Du är i Demoläge.</span>
        <span style={{ color: '#334155', fontWeight: 500 }}>Här kan du testa alla funktioner fritt med låtsasdata.</span>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          onClick={stopDemo}
          style={{
            background: '#0f172a',
            border: 'none',
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          🚪 Avsluta Demo
        </button>

        <button
          onClick={() => {
            stopDemo();
            openAuthModal();
          }}
          style={{
            background: '#2563eb', // Nice blue for contrast against yellow
            color: '#fff',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(37,99,235,0.4)',
            transition: 'all 0.2s'
          }}
        >
          ✨ Skapa gratis konto
        </button>
      </div>
    </div>
  );
}
