import type { Account } from '../types';
import { useStore } from '../store';
import OnboardingWizard from './OnboardingWizard';

interface Props {
  currentMonth: string;
}

export default function MonthView({ currentMonth }: Props) {
  const state = useStore(s => s.state);
  const updateBillAmount = useStore(s => s.updateBillAmount);
  const confirmAnomalyStore = useStore(s => s.confirmAnomaly);
  const togglePaymentStatus = useStore(s => s.togglePaymentStatus);
  const monthData = state.months[currentMonth] || { monthId: currentMonth, billAmounts: {}, handledPayments: {} };
  
  // Calculate locked accounts
  const handled = monthData.handledPayments || {};
  const lockedAccounts = new Set<string>();
  Object.keys(handled).forEach(paymentId => {
    if (handled[paymentId]) {
      if (paymentId === 'top_total_lock') {
        state.accounts.forEach(acc => lockedAccounts.add(acc.id));
      } else if (paymentId.startsWith('transfer_')) {
        const parts = paymentId.split('_');
        const personId = parts[1];
        const sharedId = parts.slice(2).join('_');
        lockedAccounts.add(personId);
        lockedAccounts.add(sharedId);
      } else if (paymentId.startsWith('swish_')) {
        const parts = paymentId.split('_');
        if (parts.length > 3 && parts[2] === 'to') {
            lockedAccounts.add(parts[1]);
            lockedAccounts.add(parts.slice(3).join('_'));
        } else {
            lockedAccounts.add(parts[1]);
            lockedAccounts.add(parts[2]);
        }
      }
    }
  });

  // Sort all months including the current one, so we can always find the previous month
  const allMonths = Array.from(new Set([...Object.keys(state.months), currentMonth])).sort();

  const totalSum = state.bills.reduce((acc, bill) => {
    // Endast räkna med om den ska visas denna månad
    const isVisible = !bill.isArchived || (monthData.billAmounts[bill.id] !== undefined && monthData.billAmounts[bill.id] > 0);
    if (!isVisible) return acc;
    const amount = monthData.billAmounts[bill.id] !== undefined ? monthData.billAmounts[bill.id] : bill.defaultAmount;
    return acc + (amount > 0 ? amount : 0);
  }, 0);

  const renderCategory = (account: Account) => {
    const categoryBills = state.bills
      .filter(b => b.accountId === account.id && (!b.isArchived || (monthData.billAmounts[b.id] !== undefined && monthData.billAmounts[b.id] > 0)))
      .sort((a, b) => a.name.localeCompare(b.name, 'sv'));
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
                  {lockedAccounts.has(account?.id || '') ? (
                    <>
                      <div className="bill-amount-wrapper">
                        <div style={{ textAlign: 'right', padding: '0.75rem 1rem', paddingRight: '2.5rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          {amount === 0 ? '-' : amount}
                        </div>
                      </div>
                      {bill.isLoan && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span>Amortering:</span>
                          <span style={{ background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                            {monthData.billAmortization?.[bill.id] !== undefined ? monthData.billAmortization[bill.id] : (amount === 0 ? '-' : amount)} kr
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                      <div className="bill-amount-wrapper">
                        <input 
                          type="number" 
                          value={amount === 0 ? '' : amount} 
                          placeholder="Totalt"
                          onChange={(e) => {
                            const val = e.target.value;
                            const currentAmort = monthData.billAmortization?.[bill.id];
                            updateBillAmount(currentMonth, bill.id, val === '' ? 0 : parseFloat(val), currentAmort);
                          }}
                          min="0"
                          style={{ 
                            color: isAnomaly ? '#f43f5e' : 'inherit',
                            borderColor: isAnomaly ? '#f43f5e' : (showWarning ? '#f43f5e' : 'var(--border-color)'),
                            boxShadow: isAnomaly ? '0 0 10px rgba(244, 63, 94, 0.4)' : (showWarning ? '0 0 0 1px #f43f5e' : 'none')
                          }}
                        />
                      </div>
                      {bill.isLoan && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Varav amortering:</span>
                          <div className="bill-amount-wrapper" style={{ width: '100px' }}>
                            <input 
                              type="number" 
                              value={monthData.billAmortization?.[bill.id] !== undefined ? monthData.billAmortization[bill.id] : (amount === 0 ? '' : amount)}
                              onChange={(e) => {
                                const amortVal = e.target.value;
                                updateBillAmount(currentMonth, bill.id, amount, amortVal === '' ? undefined : parseFloat(amortVal));
                              }}
                              min="0"
                              style={{ 
                                fontSize: '0.9rem', padding: '0.4rem 2.5rem 0.4rem 0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'var(--text-primary)'
                              }}
                              title="Varav amortering"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {isAnomaly && (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button 
                        onClick={() => updateBillAmount(currentMonth, bill.id, latestPaid)}
                        style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        title={`Återställ till ${latestPaid} kr`}
                      >
                        ↩️ Ångra
                      </button>
                      <button 
                        onClick={() => confirmAnomalyStore(currentMonth, bill.id)}
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
    <div>
      {state.bills.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', width: '100%' }}>
          <OnboardingWizard />
          {!useStore.getState().isDemoMode && (
            <div style={{ marginTop: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '600px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Osäker på hur det funkar?</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Fyll appen med påhittad testdata så du kan utforska EkonomiTB och se hur en månad ser ut när allt är klart.</p>
              <button 
                onClick={() => useStore.getState().startDemo()}
                style={{ background: 'var(--accent-gradient)', color: '#fff', border: 'none', padding: '1rem 2rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)' }}
              >
                🛠️ Starta Demo-läge
              </button>
            </div>
          )}
        </div>
      )}
      {state.bills.length > 0 && state.settings?.showTopTotal !== false && (
        <div style={{ 
          marginBottom: '2rem', 
          padding: '1.5rem', 
          background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
          border: '1px solid rgba(168, 85, 247, 0.2)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '16px', 
          textAlign: 'center', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Hushållets gemensamma utgifter
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
            <span className="highlight-value">{totalSum.toLocaleString('sv-SE')} kr</span>
          </div>
          {state.settings?.enableManagementButtons !== false && (
            <button
              onClick={() => togglePaymentStatus(currentMonth, 'top_total_lock')}
              style={{
                 marginTop: '1rem',
                 background: handled['top_total_lock'] ? 'var(--success-color)' : 'transparent',
                 color: handled['top_total_lock'] ? '#fff' : 'var(--text-secondary)',
                 border: handled['top_total_lock'] ? '2px solid var(--success-color)' : '2px solid var(--text-secondary)',
                 padding: '0.5rem 1.5rem',
                 borderRadius: '20px',
                 cursor: handled['top_total_lock'] ? 'default' : 'pointer',
                 fontWeight: 600,
                 fontSize: '0.9rem',
                 display: 'inline-flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 gap: '0.5rem'
              }}
              disabled={handled['top_total_lock']}
            >
              {handled['top_total_lock'] ? '🔒 Låst' : '✅ Markera som hanterad'}
            </button>
          )}
        </div>
      )}
      {state.bills.length > 0 && (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', marginTop: state.settings?.showTopTotal !== false ? '0' : '1.5rem' }}>
            {Object.values(state.months[currentMonth]?.handledPayments || {}).some(v => v) ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'inline-block' }}>
                🔒 Vissa betalningar är låsta. Lås upp för att kunna hämta historik.
              </div>
            ) : (
              <button 
                onClick={() => useStore.getState().copyFromPreviousMonth(currentMonth)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', background: 'var(--surface-color)' }}
              >
                📄 Hämta siffror från förra månaden
              </button>
            )}
          </div>
      )}
      {state.bills.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {[...state.accounts].sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(account => renderCategory(account))}
        </div>
      )}
    </div>
  );
}
