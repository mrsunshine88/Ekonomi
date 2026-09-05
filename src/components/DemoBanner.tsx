import React from 'react';
import { useStore } from '../store';

export default function DemoBanner() {
  const isDemoMode = useStore(s => s.isDemoMode);
  const stopDemo = useStore(s => s.stopDemo);
  const openAuthModal = useStore(s => s.openAuthModal);

  if (!isDemoMode) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0.75rem 1rem',
      boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
      gap: '1.5rem',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '0.95rem' }}>
        <span>🛠️</span>
        <span style={{ fontWeight: 600 }}>Du är i Demoläge.</span>
        <span style={{ color: 'var(--text-secondary)' }}>Här kan du testa alla funktioner fritt med låtsasdata.</span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          onClick={stopDemo}
          style={{
            background: 'transparent',
            border: '1px solid #f43f5e',
            color: '#f43f5e',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s'
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
            background: 'var(--accent-gradient)',
            color: '#fff',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)',
            transition: 'all 0.2s'
          }}
        >
          ✨ Skapa gratis konto
        </button>
      </div>
    </div>
  );
}
