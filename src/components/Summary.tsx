import { useState } from 'react';
import { useStore, calculateMonth } from '../store';

interface Props {
  currentMonth: string;
}

export default function Summary({ currentMonth }: Props) {
  const state = useStore(s => s.state);
  const togglePaymentStatus = useStore(s => s.togglePaymentStatus);
  const monthData = state.months[currentMonth] || { monthId: currentMonth, billAmounts: {}, handledPayments: {} };
  const result = calculateMonth(state, currentMonth);
  const showTransfers = (state.settings?.showTransferSummary ?? state.settings?.showSummary) !== false;
  const showSwishes = (state.settings?.showSwishSummary ?? state.settings?.showSummary) !== false;
  const enableManagementButtons = state.settings?.enableManagementButtons !== false;

  const [warningModal, setWarningModal] = useState<{ visible: boolean; bills: typeof state.bills }>({ visible: false, bills: [] });
  const handled = monthData.handledPayments || {};

  const missingBills = state.bills.filter(bill => {
    if (bill.startMonth && bill.startMonth > currentMonth) return false;

    const amount = monthData.billAmounts[bill.id] !== undefined ? monthData.billAmounts[bill.id] : bill.defaultAmount;
    if (bill.warnIfZero && amount === 0) {
      const monthNumber = parseInt((monthData.monthId || currentMonth).split('-')[1], 10);
      const isOddMonth = monthNumber % 2 !== 0;
      
      if (bill.interval === 'all') return true;
      if (bill.interval === 'odd' && isOddMonth) return true;
      if (bill.interval === 'even' && !isOddMonth) return true;
      if (bill.interval === 'custom' && bill.customMonths?.includes(monthNumber)) return true;
    }
    return false;
  });

  const missingPersonBills = missingBills.filter(b => {
    const acc = state.accounts.find(a => a.id === b.accountId);
    return acc?.type === 'person';
  });
  
  const missingSharedBills = missingBills.filter(b => {
    const acc = state.accounts.find(a => a.id === b.accountId);
    return acc?.type === 'shared';
  });

  const handleToggle = (paymentId: string) => {
    let relevantBills = missingBills;
    if (paymentId.startsWith('swish_')) {
      relevantBills = missingPersonBills;
    } else if (paymentId.startsWith('transfer_')) {
      relevantBills = missingSharedBills;
    }

    if (relevantBills.length > 0) {
      setWarningModal({ visible: true, bills: relevantBills });
      return;
    }
    togglePaymentStatus(currentMonth,paymentId);
  };

  return (
    <div className="summary-box" style={{ position: 'relative' }}>
      
      {warningModal.visible && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(11, 15, 25, 0.95)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, borderRadius: '16px', padding: '2rem', textAlign: 'center',
          border: '1px solid rgba(244, 63, 94, 0.3)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚨</div>
          <h3 style={{ color: '#f43f5e', fontSize: '1.5rem', marginBottom: '1rem' }}>Räkningar saknas!</h3>
          <p style={{ color: '#f1f5f9', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Du kan inte klarmarkera betalningar förrän alla förväntade räkningar är ifyllda.</p>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Saknas just nu: <strong style={{ color: '#fff' }}>{warningModal.bills.map(b => b.name).join(', ')}</strong>
          </p>
          <button 
            onClick={() => setWarningModal({ visible: false, bills: [] })}
            style={{ background: '#f43f5e', color: 'white', padding: '0.75rem 2.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(244, 63, 94, 0.4)' }}
          >
            Jag förstår
          </button>
        </div>
      )}
      
      {/* Transfers to Shared Accounts */}
      {showTransfers && Object.keys(result.transfersToShared).length > 0 && (
        <div className="summary-grid">
          {Object.entries(result.transfersToShared).map(([personId, sharedObj]) => {
            const person = state.accounts.find(a => a.id === personId);
            if (!person) return null;
            
            return Object.entries(sharedObj).map(([sharedId, amount]) => {
              if (amount <= 0.01) return null;
              
              const sharedAcc = state.accounts.find(a => a.id === sharedId);
              if (!sharedAcc) return null;

              const paymentId = `transfer_${personId}_${sharedId}`;
              const isPaid = handled[paymentId];
              const isTransfer = sharedAcc.transferMethod === 'transfer';

              return (
                <div key={paymentId} className={`summary-item ${isPaid ? 'paid' : ''}`} style={{ transition: 'background 0.3s', background: isPaid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.2)' }}>
                  <div className="summary-label">
                    {(() => {
                      const pName = person.name.replace(/ kontot?|konto/gi, '').trim();
                      const fromName = pName.charAt(0).toUpperCase() + pName.slice(1).toLowerCase();
                      const toName = sharedAcc.name.toLowerCase();
                      return `${fromName} ${isTransfer ? 'för över till' : 'swishar till'} ${toName}`;
                    })()}
                  </div>
                  <div className="summary-value highlight-value" style={{ filter: isPaid ? 'brightness(0.8)' : 'none' }}>
                    {amount.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                  </div>
                  {enableManagementButtons && (
                    <button 
                      onClick={() => { if (!isPaid) handleToggle(paymentId); }}
                      style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, background: isPaid ? 'var(--success-color)' : 'transparent', color: isPaid ? '#fff' : 'var(--text-secondary)', border: isPaid ? '2px solid var(--success-color)' : '2px solid var(--text-secondary)', borderRadius: '20px', cursor: isPaid ? 'default' : 'pointer', opacity: missingSharedBills.length > 0 ? 0.6 : 1 }}
                      disabled={isPaid}
                    >
                      {isPaid ? (isTransfer ? '🔒 Överfört (Låst)' : '🔒 Swishat (Låst)') : (isTransfer ? 'Markera som överfört' : 'Markera som Swishat')}
                    </button>
                  )}
                </div>
              );
            });
          })}
        </div>
      )}
      
      {/* Explicit Swishes */}
      {showSwishes && (result.swishes.length > 0 ? (
        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {result.swishes.map((swish, index) => {
            const fromPerson = state.accounts.find(a => a.id === swish.fromId);
            const toPerson = state.accounts.find(a => a.id === swish.toId);
            
            let paymentId = `swish_${swish.fromId}_to_${swish.toId}`;
            // migration compatibility
            if (swish.fromId === 'andreas' && swish.toId === 'helena') paymentId = 'swish_andreas_helena';
            if (swish.fromId === 'helena' && swish.toId === 'andreas') paymentId = 'swish_helena_andreas';

            const isPaid = handled[paymentId];

            return (
              <div key={index} className={`swish-result ${isPaid ? 'paid' : ''}`} style={{ position: 'relative', transition: 'all 0.3s', opacity: isPaid ? 0.8 : 1 }}>
                <div className="swish-text">
                  {(() => {
                    const fNameRaw = (fromPerson?.name || '').replace(/ kontot?|konto/gi, '').trim();
                    const tNameRaw = (toPerson?.name || '').replace(/ kontot?|konto/gi, '').trim();
                    const fName = fNameRaw.charAt(0).toUpperCase() + fNameRaw.slice(1).toLowerCase();
                    const tName = tNameRaw.charAt(0).toUpperCase() + tNameRaw.slice(1).toLowerCase();
                    return `${fName} swishar till ${tName}`;
                  })()}
                </div>
                <div className="swish-amount">{swish.amount.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr</div>
                {enableManagementButtons && (
                  <button 
                    onClick={() => { if (!isPaid) handleToggle(paymentId); }}
                    style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, background: isPaid ? 'var(--success-color)' : 'transparent', color: isPaid ? '#fff' : 'inherit', border: isPaid ? '2px solid var(--success-color)' : '2px solid currentColor', borderRadius: '20px', cursor: isPaid ? 'default' : 'pointer', opacity: missingPersonBills.length > 0 ? 0.6 : 1 }}
                    disabled={isPaid}
                  >
                    {isPaid ? (toPerson?.transferMethod === 'transfer' ? '🔒 Överfört (Låst)' : '🔒 Swishat (Låst)') : (toPerson?.transferMethod === 'transfer' ? 'Markera som Överfört' : 'Markera som Swishat')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '2rem', padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Inga swishar behövs denna månad! 🎉</p>
        </div>
      ))}
    </div>
  );
}
