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
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(168, 85, 247, 0.3)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0.75rem 1rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      gap: '1.5rem',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f8fafc', fontSize: '0.95rem' }}>
        <span style={{ fontSize: '1.2rem' }}>✨</span>
        <span style={{ fontWeight: 600, letterSpacing: '0.5px' }}>Demoläge aktivt.</span>
        <span style={{ color: 'var(--text-secondary)' }}>Utforska alla premiumfunktioner med testdata.</span>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button
          onClick={stopDemo}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'var(--text-secondary)',
            padding: '0.5rem 1.2rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
        >
          Avsluta Demo
        </button>

        <button
          onClick={() => {
            stopDemo();
            openAuthModal();
          }}
          style={{
            background: 'var(--accent-gradient)',
            color: '#fff',
            border: 'none',
            padding: '0.5rem 1.5rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(168, 85, 247, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.4)';
          }}
        >
          Skapa gratis konto
        </button>
      </div>
    </div>
  );
}
