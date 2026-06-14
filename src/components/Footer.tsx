import { useState } from 'react';
import InfoModal from './InfoModal';
import SubscriptionFeaturesModal from './SubscriptionFeaturesModal';

export default function Footer() {
  const [modalType, setModalType] = useState<'tos' | 'privacy' | 'contact' | 'features' | 'faq' | null>(null);

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
            onClick={() => setModalType('features')}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#10b981', fontWeight: 'bold' }}
          >
            💎 Prenumerera
          </button>
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
          <button 
            onClick={() => setModalType('faq')}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            Frågor & Svar (FAQ)
          </button>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          &copy; {new Date().getFullYear()} SmartEkonomi. Alla rättigheter förbehållna.
        </div>
      </footer>

      {modalType && modalType !== 'features' && (
        <InfoModal type={modalType as any} onClose={() => setModalType(null)} />
      )}
      
      {modalType === 'features' && (
        <SubscriptionFeaturesModal onClose={() => setModalType(null)} />
      )}
    </>
  );
}
