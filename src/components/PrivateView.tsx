import React, { useState } from 'react';
import type { AppState, PrivateBill } from '../types';
import { useAuth } from '../AuthContext';

interface Props {
  state: AppState;
  currentMonth: string;
  onChangeAmount: (billId: string, amount: number) => void;
  onAddBill: (bill: PrivateBill) => void;
  onRemoveBill: (billId: string) => void;
  onUpdateBill: (bill: PrivateBill) => void;
}

export default function PrivateView({ state, currentMonth, onChangeAmount, onAddBill, onRemoveBill, onUpdateBill }: Props) {
  const { user } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [newBillName, setNewBillName] = useState('');
  const [newBillAmount, setNewBillAmount] = useState(0);

  if (!user) return <div style={{ color: '#fff', textAlign: 'center', marginTop: '2rem' }}>Logga in för att se dina privata utgifter.</div>;

  const myBills = (state.privateBills || []).filter(b => b.userId === user.id);
  const sharedBills = (state.privateBills || []).filter(b => b.userId !== user.id && b.isShared);
  const monthData = state.privateMonths?.[currentMonth] || { monthId: currentMonth, billAmounts: {}, handledPayments: {} };

  const handleAdd = () => {
    if (!newBillName.trim()) return;
    onAddBill({
      id: 'priv_' + crypto.randomUUID(),
      name: newBillName,
      defaultAmount: newBillAmount,
      interval: 'all',
      userId: user.id,
      isShared: false
    });
    setNewBillName('');
    setNewBillAmount(0);
    setIsAdding(false);
  };

  const totalPrivateCost = myBills.reduce((acc, bill) => {
    const amt = monthData.billAmounts[bill.id] !== undefined ? monthData.billAmounts[bill.id] : bill.defaultAmount;
    return acc + amt;
  }, 0);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', margin: 0, marginBottom: '0.25rem' }}>🔒 Privat Ekonomi</h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Dessa utgifter delas inte med hushållet.
          </div>
        </div>
        <button onClick={() => setIsAdding(!isAdding)} style={{ background: 'var(--accent-gradient)', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          {isAdding ? 'Avbryt' : '+ Ny Utgift'}
        </button>
      </div>

      {isAdding && (
        <div className="card" style={{ marginBottom: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          <h3 className="card-title">Lägg till privat utgift</h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Namn (t.ex. Snus)" value={newBillName} onChange={e => setNewBillName(e.target.value)} style={{ flex: '1 1 200px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }} />
            <div style={{ position: 'relative', flex: '0 0 120px' }}>
              <input type="number" placeholder="Belopp" value={newBillAmount || ''} onChange={e => setNewBillAmount(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '0.75rem', paddingRight: '2rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }} />
              <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>kr</span>
            </div>
          </div>
          <button onClick={handleAdd} style={{ width: '100%', padding: '0.75rem', background: 'var(--success-color)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Spara utgift</button>
        </div>
      )}

      {myBills.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤫</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Inga privata utgifter</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Här kan du lägga till utgifter som bara du ser och som inte räknas med i er gemensamma Swish-uppgörelse.</p>
        </div>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 className="card-title" style={{ margin: 0, border: 'none', padding: 0 }}>Mina privata kostnader</h3>
            <div style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Totalt: {totalPrivateCost} kr</div>
          </div>
          
          <div className="bill-list">
            {myBills.map(bill => {
              const amount = monthData.billAmounts[bill.id] !== undefined ? monthData.billAmounts[bill.id] : bill.defaultAmount;
              
              return (
                <div key={bill.id} className="bill-row" style={{ alignItems: 'center' }}>
                  <div className="bill-info">
                    <div className="bill-name">{bill.name}</div>
                    <div className="bill-meta" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.25rem' }}>
                      <button 
                        onClick={() => onUpdateBill({...bill, isShared: !bill.isShared})} 
                        style={{ background: 'transparent', border: 'none', color: bill.isShared ? '#10b981' : 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        title={bill.isShared ? "Synlig för hela hushållet (men privat i uträkningen)" : "Helt privat"}
                      >
                        {bill.isShared ? '👁️ Delad (Synlig för andra)' : '🔒 Privat (Ingen ser denna)'}
                      </button>
                      <button 
                        onClick={() => { if(window.confirm('Radera privat utgift?')) onRemoveBill(bill.id) }} 
                        style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>
                  <div className="bill-amount-wrapper">
                    <input 
                      type="number" 
                      value={amount === 0 ? '' : amount} 
                      onChange={(e) => {
                        const val = e.target.value;
                        onChangeAmount(bill.id, val === '' ? 0 : parseFloat(val));
                      }}
                      min="0"
                      style={{ borderColor: 'var(--border-color)', width: '100px', textAlign: 'right' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sharedBills.length > 0 && (
        <div className="card" style={{ marginTop: '2rem', background: 'rgba(255,255,255,0.02)' }}>
          <h3 className="card-title" style={{ color: 'var(--text-secondary)' }}>Delade utgifter (Från andra i hushållet)</h3>
          <div className="bill-list">
            {sharedBills.map(bill => {
              const amount = monthData.billAmounts[bill.id] !== undefined ? monthData.billAmounts[bill.id] : bill.defaultAmount;
              
              return (
                <div key={bill.id} className="bill-row" style={{ opacity: 0.8 }}>
                  <div className="bill-info">
                    <div className="bill-name">{bill.name}</div>
                    <div className="bill-meta">Skapad av en annan medlem</div>
                  </div>
                  <div className="bill-amount-wrapper">
                    <div style={{ textAlign: 'right', padding: '0.75rem 1rem', paddingRight: '2.5rem', color: 'var(--text-secondary)' }}>
                      {amount === 0 ? '-' : amount} kr
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
