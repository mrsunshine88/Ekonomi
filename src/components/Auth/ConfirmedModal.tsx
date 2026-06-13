import React from 'react';

export default function ConfirmedModal({ onClose }: { onClose: () => void }) {
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
        padding: '3rem 2rem', 
        maxWidth: '500px', 
        width: '100%', 
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)' 
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
        <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: '1rem' }}>
          Din e-post är bekräftad!
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: '1.6' }}>
          Välkommen till SmartEkonomi. Allt är nu redo för att du ska kunna automatisera hushållets räkningar och slippa Excel-arken för alltid.
        </p>
        
        <button 
          onClick={onClose}
          style={{ 
            background: 'var(--accent-gradient)', 
            color: '#fff', 
            padding: '1rem 2rem', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: 'bold', 
            fontSize: '1.1rem', 
            width: '100%',
            transition: 'all 0.2s',
            boxShadow: '0 4px 15px rgba(244, 63, 94, 0.3)'
          }}
        >
          Ta mig till appen! 🚀
        </button>
      </div>
    </div>
  );
}
