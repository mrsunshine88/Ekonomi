import { useState } from 'react';
import { useStore } from '../store';
import { supabase } from '../supabase';
import SubscriptionFeaturesModal from './SubscriptionFeaturesModal';
interface PaywallModalProps {
  onClose?: () => void;
}

export default function PaywallModal({ onClose }: PaywallModalProps) {
  const [loading, setLoading] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const householdId = useStore(s => s.householdId);
  const bills = useStore(s => s.state.bills);
  const incomes = useStore(s => s.state.incomes);

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
    } catch (e: unknown) {
      alert('Kunde inte starta betalning: ' + (e instanceof Error ? e.message : String(e)));
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
        <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: '1rem' }}>Din första budget är klar.</h2>
        
        {bills.length > 0 || incomes.length > 0 ? (
          <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>SmartEkonomi hittade:</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#fff' }}>
              {bills.length > 0 && <li style={{ marginBottom: '0.25rem' }}>✓ {bills.length} återkommande betalningar</li>}
              {incomes.length > 0 && <li>✓ {incomes.length} inkomster</li>}
            </ul>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Aktivera abonnemang för att bygga din budget från grunden och hantera betalningar.
          </p>
        )}

        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: '1.6' }}>
          Nu kan du börja registrera betalningar, följa hushållets ekonomi och planera framtida månader.
          <br /><br />
          <strong style={{ color: '#10b981' }}>🎁 Prova gratis i 14 dagar</strong> innan du debiteras. Avsluta när du vill.
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
          {loading ? 'Laddar Stripe...' : 'Köp abonnemang'}
        </button>

        {onClose && (
          <button 
            onClick={onClose}
            style={{ 
              background: 'transparent', 
              color: 'var(--text-primary)', 
              padding: '1rem 2rem', 
              border: '1px solid var(--border-color)', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: 'bold', 
              fontSize: '1.1rem', 
              width: '100%',
              marginBottom: '1.5rem',
              transition: 'background 0.2s'
            }}
          >
            Fortsätt titta
          </button>
        )}

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

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button 
            onClick={() => supabase.auth.signOut()}
            style={{ 
              background: 'transparent', 
              border: '1px solid #f43f5e', 
              color: '#f43f5e', 
              padding: '0.5rem 1rem', 
              borderRadius: '8px', 
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 'bold'
            }}
          >
            🚪 Logga ut
          </button>
        </div>
      </div>

      {showFeatures && <SubscriptionFeaturesModal onClose={() => setShowFeatures(false)} />}
    </div>
  );
}
