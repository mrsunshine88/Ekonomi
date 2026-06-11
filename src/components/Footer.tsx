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
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            Användarvillkor
          </button>
          <button 
            onClick={() => setModalType('privacy')}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            Integritetspolicy
          </button>
          <button 
            onClick={() => setModalType('contact')}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
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
