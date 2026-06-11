import { useState } from 'react';
import InfoModal from './InfoModal';

export default function Footer() {
  const [modalType, setModalType] = useState<'tos' | 'privacy' | 'contact' | null>(null);

  return (
    <>
      <footer style={{
        marginTop: 'auto',
        padding: '3rem 1rem 2rem 1rem',
        background: 'transparent',
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
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', padding: '0.5rem', textDecoration: 'underline', textUnderlineOffset: '4px' }}
          >
            Användarvillkor
          </button>
          <button 
            onClick={() => setModalType('privacy')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', padding: '0.5rem', textDecoration: 'underline', textUnderlineOffset: '4px' }}
          >
            Integritetspolicy
          </button>
          <button 
            onClick={() => setModalType('contact')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', padding: '0.5rem', textDecoration: 'underline', textUnderlineOffset: '4px' }}
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
