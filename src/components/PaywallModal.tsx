import { useState } from 'react';
import { useStore } from '../store';
import { supabase } from '../supabase';
import SubscriptionFeaturesModal from './SubscriptionFeaturesModal';

export default function PaywallModal() {
  const [loading, setLoading] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const householdId = useStore(s => s.householdId);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          householdId,
          customerEmail: session?.user?.email
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Redirect to Stripe
      window.location.href = data.url;
    } catch (e: any) {
      alert('Kunde inte starta betalning: ' + e.message);
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 15, 25, 0.95)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '2rem', textAlign: 'center'
    }}>
      <div style={{ 
        background: 'rgba(30, 41, 59, 0.9)', 
        border: '1px solid rgba(16, 185, 129, 0.3)', 
        borderRadius: '16px', 
        padding: '3rem 2rem', 
        maxWidth: '450px', 
        width: '100%', 
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)' 
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💎</div>
        <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: '1rem' }}>Börja prenumerera</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: '1.6' }}>
          Hoppas du gillar SmartEkonomi! För att få full tillgång och fortsätta låsa dina månader, uppgradera till Premium.
        </p>
        
        <div style={{ 
          background: 'rgba(0,0,0,0.3)', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          marginBottom: '2rem',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success-color)' }}>59 kr <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>/ mån</span></div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Avsluta när du vill</div>
        </div>

        <button 
          onClick={handleCheckout}
          disabled={loading}
          style={{ 
            background: 'var(--success-color)', 
            color: 'white', 
            padding: '1rem 2rem', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: 'bold', 
            fontSize: '1.2rem', 
            width: '100%',
            marginBottom: '1rem',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)' 
          }}
        >
          {loading ? 'Laddar Stripe...' : 'Gå till betalning'}
        </button>

        <button 
          onClick={() => setShowFeatures(true)}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: 'var(--text-secondary)', 
            textDecoration: 'underline', 
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Vad ingår i prenumerationen? Läs mer här
        </button>
      </div>

      {showFeatures && <SubscriptionFeaturesModal onClose={() => setShowFeatures(false)} />}
    </div>
  );
}
