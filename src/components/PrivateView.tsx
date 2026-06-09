
import type { AppState, PrivateBill } from '../types';
import { useAuth } from '../AuthContext';

interface Props {
  state: AppState;
  currentMonth: string;
  onChangeAmount: (billId: string, amount: number) => void;
  onUpdateBill: (bill: PrivateBill) => void;
  onConfirmAnomaly: (monthId: string, billId: string) => void;
  onToggleLock: (monthId: string) => void;
}

export default function PrivateView({ state, currentMonth, onChangeAmount, onUpdateBill, onConfirmAnomaly, onToggleLock }: Props) {
  const { user } = useAuth();

  if (!user) return <div style={{ color: '#fff', textAlign: 'center', marginTop: '2rem' }}>Logga in för att se dina privata utgifter.</div>;

  const monthData = state.privateMonths?.[currentMonth] || { monthId: currentMonth, billAmounts: {}, handledPayments: {} };
  const myBills = (state.privateBills || []).filter(b => b.userId === user.id && (!b.isArchived || monthData.billAmounts[b.id] !== undefined));
  const sharedBills = (state.privateBills || []).filter(b => b.userId !== user.id && b.isShared && (!b.isArchived || monthData.billAmounts[b.id] !== undefined));
  const isLocked = monthData.isLocked || false;

  // Sort all months for history tracking
  const allMonths = Array.from(new Set([...Object.keys(state.privateMonths || {}), currentMonth])).sort();

  const totalPrivateCost = myBills.reduce((acc, bill) => {
    const amt = monthData.billAmounts[bill.id] !== undefined ? monthData.billAmounts[bill.id] : bill.defaultAmount;
    return acc + amt;
  }, 0);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ color: 'var(--text-primary)', margin: 0, marginBottom: '0.25rem' }}>
          🔒 Privat Ekonomi {isLocked && <span title="Månaden är låst" style={{ fontSize: '1rem', marginLeft: '0.5rem' }}>🔒</span>}
        </h2>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Dessa utgifter delas inte med hushållet. Du hanterar dem i Inställningar.
        </div>
      </div>

      {myBills.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤫</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Inga privata utgifter</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Gå till Inställningar -&gt; Räkningar för att skapa dina första privata räkningar.</p>
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
              
              // Anomaly detection
              const isConfirmed = monthData.confirmedAnomalies?.[bill.id];
              const paidHistory = allMonths
                .filter(m => m < currentMonth)
                .map(m => state.privateMonths?.[m]?.billAmounts[bill.id] !== undefined ? state.privateMonths[m].billAmounts[bill.id] : bill.defaultAmount)
                .filter(amt => amt > 0);
              
              const latestPaid = paidHistory.length > 0 ? paidHistory[paidHistory.length - 1] : bill.defaultAmount;

              let isAnomaly = false;
              let anomalyText = '';
              if (amount > 0 && !isConfirmed && !isLocked) {
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
              if (bill.warnIfZero && amount === 0 && !isLocked) {
                 const monthNumber = parseInt(currentMonth.split('-')[1], 10);
                 const isOddMonth = monthNumber % 2 !== 0;
                 if (bill.interval === 'all') showWarning = true;
                 else if (bill.interval === 'odd' && isOddMonth) showWarning = true;
                 else if (bill.interval === 'even' && !isOddMonth) showWarning = true;
                 else if (bill.interval === 'custom' && bill.customMonths?.includes(monthNumber)) showWarning = true;
              }

              return (
                <div key={bill.id} className="bill-row" style={{ alignItems: isAnomaly ? 'flex-start' : 'center' }}>
                  <div className="bill-info" style={{ paddingTop: isAnomaly ? '0.5rem' : '0' }}>
                    <div className="bill-name" style={{ color: (showWarning || isAnomaly) ? '#f43f5e' : 'inherit' }}>
                      {bill.name}
                    </div>
                    <div className="bill-meta" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.25rem' }}>
                      <button 
                        onClick={() => onUpdateBill({...bill, isShared: !bill.isShared})} 
                        style={{ background: 'transparent', border: 'none', color: bill.isShared ? '#10b981' : 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        title={bill.isShared ? "Synlig för hela hushållet (men privat i uträkningen)" : "Helt privat"}
                      >
                        {bill.isShared ? '👁️ Delad (Synlig för andra)' : '🔒 Privat (Ingen ser denna)'}
                      </button>
                    </div>
                    {(showWarning || isAnomaly) && (
                      <div className="bill-meta" style={{ marginTop: '0.5rem' }}>
                        {showWarning && <span style={{ color: '#f43f5e', display: 'block', fontWeight: 500 }}>⚠️ Saknas</span>}
                        {isAnomaly && <span style={{ color: '#f43f5e', display: 'block', fontWeight: 500 }}>🚨 {anomalyText}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0, paddingTop: isAnomaly ? '0.5rem' : '0' }}>
                    <div className="bill-amount-wrapper">
                      {isLocked ? (
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
                            boxShadow: isAnomaly ? '0 0 10px rgba(244, 63, 94, 0.4)' : (showWarning ? '0 0 0 1px #f43f5e' : 'none'),
                            width: '100px', 
                            textAlign: 'right' 
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
                          onClick={() => onConfirmAnomaly(currentMonth, bill.id)}
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

          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
            {isLocked ? (
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                🔒 Denna månad är låst. Gå till <strong>Inställningar -&gt; 🔒 Lås upp</strong> för att ändra siffrorna.
              </div>
            ) : (
              <>
                <button 
                  onClick={() => onToggleLock(currentMonth)}
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    margin: '0 auto',
                    transition: 'all 0.2s ease'
                  }}
                >
                  ✅ Markera månad som klar
                </button>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Låser siffrorna så att du inte råkar ändra dem.
                </div>
              </>
            )}
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
