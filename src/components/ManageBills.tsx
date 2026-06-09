import { useState } from 'react';
import type { AppState, BillDefinition, Account, PaymentInterval } from '../types';

interface Props {
  state: AppState;
  onAddBill: (bill: BillDefinition) => void;
  onRemoveBill: (billId: string) => void;
  onUpdateBill: (bill: BillDefinition) => void;
  onAddAccount: (account: Account) => void;
  onRemoveAccount: (accountId: string) => void;
  onUnlockAccount: (monthId: string, accountId: string) => void;
}

export default function ManageBills({ state, onAddBill, onRemoveBill, onUpdateBill, onAddAccount, onRemoveAccount, onUnlockAccount }: Props) {
  const [activeTab, setActiveTab] = useState<'bills' | 'accounts' | 'locks'>('bills');
  
  // New/Edit Bill State
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [newBillName, setNewBillName] = useState('');
  const [newBillAccount, setNewBillAccount] = useState(state.accounts[0]?.id || '');
  const [newBillSplit, setNewBillSplit] = useState('equal');
  const [newBillDefault, setNewBillDefault] = useState('');
  const [newBillInterval, setNewBillInterval] = useState<PaymentInterval>('all');
  const [newBillCustomMonths, setNewBillCustomMonths] = useState<number[]>([]);
  const [newBillWarn, setNewBillWarn] = useState(false);

  // New Account State
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'shared' | 'person'>('person');
  const [newAccTransferMethod, setNewAccTransferMethod] = useState<'transfer' | 'swish'>('swish');

  const handleSaveBill = () => {
    if (!newBillName.trim() || !newBillAccount) return;
    
    const billData = {
      id: editingBillId || (newBillName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now()),
      name: newBillName,
      accountId: newBillAccount,
      splitType: newBillSplit,
      defaultAmount: newBillDefault === '' ? 0 : parseFloat(newBillDefault),
      interval: newBillInterval,
      customMonths: newBillInterval === 'custom' ? newBillCustomMonths : undefined,
      warnIfZero: newBillWarn
    };

    if (editingBillId) {
      onUpdateBill(billData);
      setEditingBillId(null);
    } else {
      onAddBill(billData);
    }
    
    setNewBillName('');
    setNewBillDefault('');
    setNewBillWarn(false);
    setNewBillInterval('all');
    setNewBillCustomMonths([]);
  };

  const handleEditBill = (bill: BillDefinition) => {
    setEditingBillId(bill.id);
    setNewBillName(bill.name);
    setNewBillAccount(bill.accountId);
    setNewBillSplit(bill.splitType);
    setNewBillDefault(bill.defaultAmount ? bill.defaultAmount.toString() : '');
    setNewBillInterval(bill.interval || 'all');
    setNewBillCustomMonths(bill.customMonths || []);
    setNewBillWarn(bill.warnIfZero || false);
    
    // Smooth scroll to the form at the bottom
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const handleCancelEdit = () => {
    setEditingBillId(null);
    setNewBillName('');
    setNewBillDefault('');
    setNewBillWarn(false);
    setNewBillInterval('all');
    setNewBillCustomMonths([]);
  };

  const handleAddAccount = () => {
    if (!newAccName.trim()) return;
    onAddAccount({
      id: newAccName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now(),
      name: newAccName,
      type: newAccType,
      transferMethod: newAccTransferMethod
    });
    setNewAccName('');
  };

  return (
    <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--accent-color)' }}>
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('bills')}
          style={{ background: 'transparent', border: 'none', color: activeTab === 'bills' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'bills' ? 'bold' : 'normal', fontSize: '1.1rem', cursor: 'pointer' }}
        >
          Räkningar
        </button>
        <button 
          onClick={() => setActiveTab('accounts')}
          style={{ background: 'transparent', border: 'none', color: activeTab === 'accounts' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'accounts' ? 'bold' : 'normal', fontSize: '1.1rem', cursor: 'pointer' }}
        >
          Konton
        </button>
        <button 
          onClick={() => setActiveTab('locks')}
          style={{ background: 'transparent', border: 'none', color: activeTab === 'locks' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'locks' ? 'bold' : 'normal', fontSize: '1.1rem', cursor: 'pointer', marginLeft: 'auto' }}
        >
          🔒 Lås upp
        </button>
      </div>

      {activeTab === 'accounts' && (
        <div>
          <h3 className="card-title">Befintliga Konton</h3>
          <div className="bill-list" style={{ marginBottom: '2rem' }}>
            {state.accounts.map(acc => (
              <div key={acc.id} className="bill-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div className="bill-name">{acc.name}</div>
                  <div className="bill-meta">{acc.type === 'shared' ? 'Gemensamt konto' : 'Personligt konto'} • Mottar betalning via: {acc.transferMethod === 'transfer' ? 'Banköverföring' : 'Swish'}</div>
                </div>
                <button 
                  onClick={() => onRemoveAccount(acc.id)}
                  style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Ta bort
                </button>
              </div>
            ))}
          </div>

          <h3 className="card-title">Lägg till nytt konto</h3>
          <div style={{ display: 'grid', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
            <input 
              type="text" 
              placeholder="Kontonamn (t.ex. Barnets konto)" 
              value={newAccName} 
              onChange={e => setNewAccName(e.target.value)} 
            />
            <select value={newAccType} onChange={e => setNewAccType(e.target.value as any)}>
              <option value="person">Personligt konto (Person som kan betala & swisha)</option>
              <option value="shared">Gemensamt konto (Ett konto dit pengar ska föras över)</option>
            </select>
            <select value={newAccTransferMethod} onChange={e => setNewAccTransferMethod(e.target.value as any)}>
              <option value="swish">Betalningsmetod: Mottar pengar via Swish</option>
              <option value="transfer">Betalningsmetod: Mottar pengar via Banköverföring</option>
            </select>
            <button onClick={handleAddAccount} style={{ background: 'var(--success-color)', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              + Lägg till konto
            </button>
          </div>
        </div>
      )}

      {activeTab === 'locks' && (
        <div>
          <h3 className="card-title">Lås upp stängda konton</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            När du trycker på "Markera som överfört" så låses det kontot för den månaden. Här kan du låsa upp konton om du behöver rätta till något. (Detta avmarkerar knappen i Månadsvyn).
          </p>

          <div className="bill-list">
            {Object.keys(state.months).sort().reverse().map(monthId => {
              const monthData = state.months[monthId];
              const handled = monthData.handledPayments || {};
              
              // Kalkylera vilka konton som faktiskt ÄR låsta denna månaden
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

              if (lockedAccounts.size === 0) return null;

              return (
                <div key={monthId} className="card" style={{ marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ marginBottom: '1rem', color: 'var(--accent-color)' }}>{monthId}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {state.accounts.map(acc => {
                      const isLocked = lockedAccounts.has(acc.id);
                      if (!isLocked) return null;
                      return (
                        <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-color)', padding: '0.75rem', borderRadius: '8px' }}>
                          <span>{acc.name} 🔒</span>
                          <button 
                            onClick={() => onUnlockAccount(monthId, acc.id)}
                            style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid #3b82f6', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            🔓 Lås upp
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {Object.keys(state.months).length === 0 || !Object.values(state.months).some(m => Object.values(m.handledPayments || {}).some(v => v)) ? (
               <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Inga låsta konton hittades.</div>
            ) : null}
          </div>
        </div>
      )}

      {activeTab === 'bills' && (
        <div>
          <h3 className="card-title">Befintliga Räkningar</h3>
          <div className="bill-list" style={{ marginBottom: '2rem' }}>
            {state.bills.map(bill => {
              const account = state.accounts.find(a => a.id === bill.accountId);
              let splitText = 'Delas lika';
              if (bill.splitType !== 'equal') {
                 const p = state.accounts.find(a => a.id === bill.splitType);
                 if (p) splitText = `${p.name} betalar 100%`;
              }
              let intervalText = 'Varje månad';
              if (bill.interval === 'odd') intervalText = 'Udda månader';
              if (bill.interval === 'even') intervalText = 'Jämna månader';
              if (bill.interval === 'custom') {
                const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
                intervalText = bill.customMonths && bill.customMonths.length > 0 
                  ? `Specifika månader: ${bill.customMonths.sort((a,b)=>a-b).map(m => monthNamesShort[m-1]).join(', ')}`
                  : 'Specifika månader (Inga valda)';
              }
              
              return (
                <div key={bill.id} className="bill-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="bill-name">{bill.name} {bill.warnIfZero && '⚠️ Varning'}</div>
                    <div className="bill-meta">{account?.name} • {splitText} • {intervalText}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => handleEditBill(bill)}
                      style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Ändra
                    </button>
                    <button 
                      onClick={() => onRemoveBill(bill.id)}
                      style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <h3 className="card-title">{editingBillId ? 'Ändra räkning' : 'Lägg till ny räkning'}</h3>
          <div style={{ display: 'grid', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: editingBillId ? '2px solid var(--accent-color)' : 'none' }}>
            <input 
              type="text" 
              placeholder="Namn (t.ex. Bredband)" 
              value={newBillName} 
              onChange={e => setNewBillName(e.target.value)} 
            />
            
            <select value={newBillAccount} onChange={e => setNewBillAccount(e.target.value)}>
              <option value="" disabled>-- Välj vilket konto räkningen dras ifrån --</option>
              {state.accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
            
            <select value={newBillSplit} onChange={e => setNewBillSplit(e.target.value)}>
              <option value="equal">Delas lika på alla personer (Gemensam)</option>
              {state.accounts.filter(a => a.type === 'person').map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} betalar 100%</option>
              ))}
            </select>

            <select value={newBillInterval} onChange={e => setNewBillInterval(e.target.value as PaymentInterval)}>
              <option value="all">Betalas: Varje månad</option>
              <option value="odd">Betalas: Udda månader (Jan, Mar, Maj...)</option>
              <option value="even">Betalas: Jämna månader (Feb, Apr, Jun...)</option>
              <option value="custom">Betalas: Välj specifika månader</option>
            </select>

            {newBillInterval === 'custom' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ width: '100%', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Välj vilka månader räkningen kommer:
                </div>
                {['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'].map((m, index) => {
                  const monthNum = index + 1;
                  const isSelected = newBillCustomMonths.includes(monthNum);
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        if (isSelected) {
                          setNewBillCustomMonths(prev => prev.filter(num => num !== monthNum));
                        } else {
                          setNewBillCustomMonths(prev => [...prev, monthNum]);
                        }
                      }}
                      style={{
                        background: isSelected ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                        border: isSelected ? 'none' : '1px solid var(--border-color)',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        flex: '1 0 calc(25% - 0.5rem)',
                        minWidth: '60px',
                        fontWeight: isSelected ? 'bold' : 'normal'
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
              <input 
                type="checkbox" 
                checked={newBillWarn} 
                onChange={e => setNewBillWarn(e.target.checked)} 
                style={{ width: 'auto' }}
              />
              Varna med röd färg om jag glömmer fylla i denna (När den förväntas)
            </label>

            <input 
              type="number" 
              placeholder="Standardbelopp (Frivilligt)" 
              value={newBillDefault} 
              onChange={e => setNewBillDefault(e.target.value)} 
            />
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={handleSaveBill} style={{ flex: 1, background: 'var(--success-color)', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                {editingBillId ? 'Spara ändringar' : '+ Lägg till räkning'}
              </button>
              {editingBillId && (
                <button onClick={handleCancelEdit} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Avbryt
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
