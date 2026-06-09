import type { Account, AppState } from '../types';

interface Props {
  state: AppState;
  currentMonth: string;
  onChangeAmount: (billId: string, amount: number) => void;
  onConfirmAnomaly: (billId: string) => void;
}

export default function MonthView({ state, currentMonth, onChangeAmount, onConfirmAnomaly }: Props) {
  const monthData = state.months[currentMonth] || { monthId: currentMonth, billAmounts: {}, handledPayments: {} };
  
  // Calculate locked accounts
  const handled = monthData.handledPayments || {};
  const lockedAccounts = new Set<string>();
  Object.keys(handled).forEach(paymentId => {
    if (handled[paymentId]) {
      if (paymentId.startsWith('transfer_') && paymentId.endsWith('_huskonto')) {
        const personId = paymentId.split('_')[1];
        lockedAccounts.add(personId);
        lockedAccounts.add('huskonto');
      } else if (paymentId.startsWith('swish_')) {
        const [, fromId, toId] = paymentId.split('_');
        lockedAccounts.add(fromId);
        lockedAccounts.add(toId);
      }
    }
  });

  // Sort all months including the current one, so we can always find the previous month
  const allMonths = Array.from(new Set([...Object.keys(state.months), currentMonth])).sort();


  const renderCategory = (account: Account) => {
    const categoryBills = state.bills.filter(b => b.accountId === account.id);
    if (categoryBills.length === 0) return null;

    return (
      <div className="card" key={account.id}>
        <h3 className="card-title">
          {account.name} {lockedAccounts.has(account.id) && <span title="Kontot är låst eftersom betalning är markerad som utförd" style={{ fontSize: '0.9rem', marginLeft: '0.5rem' }}>🔒</span>}
        </h3>
        <div className="bill-list">
          {categoryBills.map(bill => {
            const amount = monthData.billAmounts[bill.id] !== undefined ? monthData.billAmounts[bill.id] : bill.defaultAmount;
            
            // Anomaly detection
            const isConfirmed = monthData.confirmedAnomalies?.[bill.id];
            
            const paidHistory = allMonths
              .filter(m => m < currentMonth)
              .map(m => state.months[m]?.billAmounts[bill.id] !== undefined ? state.months[m].billAmounts[bill.id] : bill.defaultAmount)
              .filter(amt => amt > 0);
            
            const latestPaid = paidHistory.length > 0 ? paidHistory[paidHistory.length - 1] : bill.defaultAmount;

            let isAnomaly = false;
            let anomalyText = '';
            if (amount > 0 && !isConfirmed) {
              if (paidHistory.length >= 3) {
                const min = Math.min(...paidHistory);
                const max = Math.max(...paidHistory);
                if (amount < min * 0.5) {
                  isAnomaly = true;
                  anomalyText = `Min: ${min} kr`;
                } else if (amount > max * 1.5) {
                  isAnomaly = true;
                  anomalyText = `Max: ${max} kr`;
                }
              }
            }

            let showWarning = false;
            if (bill.warnIfZero && amount === 0) {
               const monthNumber = parseInt(currentMonth.split('-')[1], 10);
               const isOddMonth = monthNumber % 2 !== 0;
               if (bill.interval === 'all') showWarning = true;
               else if (bill.interval === 'odd' && isOddMonth) showWarning = true;
               else if (bill.interval === 'even' && !isOddMonth) showWarning = true;
               else if (bill.interval === 'custom' && bill.customMonths?.includes(monthNumber)) showWarning = true;
            }

            let splitText = 'Delas lika';
            if (bill.splitType !== 'equal') {
               const p = state.accounts.find(a => a.id === bill.splitType);
               if (p) splitText = `${p.name} betalar 100%`;
            }


            return (
              <div key={bill.id} className="bill-row" style={{ alignItems: isAnomaly ? 'flex-start' : 'center' }}>
                <div className="bill-info" style={{ paddingTop: isAnomaly ? '0.5rem' : '0' }}>
                  <div className="bill-name" style={{ color: (showWarning || isAnomaly) ? '#f43f5e' : 'inherit' }}>
                    {bill.name}
                  </div>
                  <div className="bill-meta">
                    {splitText}
                    {showWarning && <span style={{ color: '#f43f5e', display: 'block', marginTop: '4px', fontWeight: 500 }}>⚠️ Saknas</span>}
                    {isAnomaly && <span style={{ color: '#f43f5e', display: 'block', marginTop: '4px', fontWeight: 500 }}>🚨 {anomalyText}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0, paddingTop: isAnomaly ? '0.5rem' : '0' }}>
                  <div className="bill-amount-wrapper">
                    {lockedAccounts.has(account?.id || '') ? (
                      <div style={{ textAlign: 'right', padding: '0.75rem 1rem', paddingRight: '2.5rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {amount === 0 ? '-' : amount}
                      </div>
                    ) : (
                      <input 
                        type="number" 
                        value={amount === 0 ? '' : amount} 
                        onChange={(e) => {
                          const val = e.target.value;
                          onChangeAmount(bill.id, val === '' ? 0 : parseFloat(val));
                        }}
                        min="0"
                        style={{ 
                          color: isAnomaly ? '#f43f5e' : 'inherit',
                          borderColor: isAnomaly ? '#f43f5e' : (showWarning ? '#f43f5e' : 'var(--border-color)'),
                          boxShadow: isAnomaly ? '0 0 10px rgba(244, 63, 94, 0.4)' : (showWarning ? '0 0 0 1px #f43f5e' : 'none')
                        }}
                      />
                    )}
                  </div>
                  {isAnomaly && (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button 
                        onClick={() => onChangeAmount(bill.id, latestPaid)}
                        style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        title={`Återställ till ${latestPaid} kr`}
                      >
                        ↩️ Ångra
                      </button>
                      <button 
                        onClick={() => onConfirmAnomaly(bill.id)}
                        style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        title="Godkänn beloppet"
                      >
                        ✅ OK
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
      {state.accounts.map(account => renderCategory(account))}
    </div>
  );
}
