import { useState } from 'react';
import InfoModal from './InfoModal';

export default function Footer() {
  const [modalType, setModalType] = useState<'tos' | 'privacy' | 'contact' | null>(null);

  return (
    <>
      <footer style={{
        marginTop: 'auto',
        padding: '2rem 1rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        background: '#0b0f19',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          marginBottom: '1rem',
        }}>
          <button 
            onClick={() => setModalType('tos')}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Användarvillkor
          </button>
          <button 
            onClick={() => setModalType('privacy')}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Integritetspolicy
          </button>
          <button 
            onClick={() => setModalType('contact')}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Kontakt
          </button>
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.2)', fontSize: '0.8rem' }}>
          &copy; {new Date().getFullYear()} Ekonomi & Swish. Alla rättigheter förbehållna.
        </div>
      </footer>

      {modalType && <InfoModal type={modalType} onClose={() => setModalType(null)} />}
    </>
  );
}
