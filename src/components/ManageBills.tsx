import { useState } from 'react';
import type { AppState, BillDefinition, Account, PaymentInterval, PrivateBill } from '../types';
import { useAuth } from '../AuthContext';

interface Props {
  state: AppState;
  onAddBill: (bill: BillDefinition) => void;
  onRemoveBill: (billId: string) => void;
  onUpdateBill: (bill: BillDefinition) => void;
  onAddPrivateBill: (bill: PrivateBill) => void;
  onRemovePrivateBill: (billId: string) => void;
  onUpdatePrivateBill: (bill: PrivateBill) => void;
  onAddAccount: (account: Account) => void;
  onRemoveAccount: (accountId: string) => void;
  onUnlockAccount: (monthId: string, accountId: string) => void;
  onUpdateSettings: (settings: Partial<AppState['settings']>) => void;
  onUnlockPrivateMonth: (monthId: string) => void;
}

export default function ManageBills({ 
  state, onAddBill, onRemoveBill, onUpdateBill, 
  onAddPrivateBill, onRemovePrivateBill, onUpdatePrivateBill,
  onAddAccount, onRemoveAccount, onUnlockAccount, onUpdateSettings, onUnlockPrivateMonth 
}: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'bills' | 'accounts' | 'locks' | 'general'>('bills');
  
  // New/Edit Bill State
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [newBillScope, setNewBillScope] = useState<'shared' | 'private'>('shared');
  const [newBillName, setNewBillName] = useState('');
  const [newBillAccount, setNewBillAccount] = useState(state.accounts[0]?.id || '');
  const [newBillSplit, setNewBillSplit] = useState('equal');
  const [newBillDefault, setNewBillDefault] = useState('');
  const [newBillInterval, setNewBillInterval] = useState<PaymentInterval>('all');
  const [newBillCustomMonths, setNewBillCustomMonths] = useState<number[]>([]);
  const [newBillWarn, setNewBillWarn] = useState(false);
  const [newBillIsLoan, setNewBillIsLoan] = useState(false);
  const [newBillTotalDebt, setNewBillTotalDebt] = useState('');

  // New Account State
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'shared' | 'person'>('person');
  const [newAccTransferMethod, setNewAccTransferMethod] = useState<'transfer' | 'swish'>('swish');

  const handleSaveBill = () => {
    if (!newBillName.trim()) return;
    if (newBillScope === 'shared' && !newBillAccount) return;
    
    if (newBillScope === 'private') {
      if (!user) return;
      const billData: PrivateBill = {
        id: editingBillId || ('priv_' + Date.now()),
        name: newBillName,
        defaultAmount: newBillDefault === '' ? 0 : parseFloat(newBillDefault),
        interval: newBillInterval,
        customMonths: newBillInterval === 'custom' ? newBillCustomMonths : undefined,
        warnIfZero: newBillWarn,
        userId: user.id,
        isShared: false, // default, can be toggled in private view
        isLoan: newBillIsLoan,
        totalDebt: newBillTotalDebt === '' ? undefined : parseFloat(newBillTotalDebt)
      };
      if (editingBillId) {
        onUpdatePrivateBill(billData);
      } else {
        onAddPrivateBill(billData);
      }
    } else {
      const billData: BillDefinition = {
        id: editingBillId || (newBillName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now()),
        name: newBillName,
        accountId: newBillAccount,
        splitType: newBillSplit,
        defaultAmount: newBillDefault === '' ? 0 : parseFloat(newBillDefault),
        interval: newBillInterval,
        customMonths: newBillInterval === 'custom' ? newBillCustomMonths : undefined,
        warnIfZero: newBillWarn,
        isLoan: newBillIsLoan,
        totalDebt: newBillTotalDebt === '' ? undefined : parseFloat(newBillTotalDebt)
      };
      if (editingBillId) {
        onUpdateBill(billData);
      } else {
        onAddBill(billData);
      }
    }
    
    setEditingBillId(null);
    setNewBillName('');
    setNewBillDefault('');
    setNewBillWarn(false);
    setNewBillIsLoan(false);
    setNewBillTotalDebt('');
    setNewBillInterval('all');
    setNewBillCustomMonths([]);
  };

  const handleEditBill = (bill: BillDefinition) => {
    setEditingBillId(bill.id);
    setNewBillScope('shared');
    setNewBillName(bill.name);
    setNewBillAccount(bill.accountId);
    setNewBillSplit(bill.splitType);
    setNewBillDefault(bill.defaultAmount ? bill.defaultAmount.toString() : '');
    setNewBillInterval(bill.interval || 'all');
    setNewBillCustomMonths(bill.customMonths || []);
    setNewBillWarn(bill.warnIfZero || false);
    setNewBillIsLoan(bill.isLoan || false);
    setNewBillTotalDebt(bill.totalDebt !== undefined ? bill.totalDebt.toString() : '');
    
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleEditPrivateBill = (bill: PrivateBill) => {
    setEditingBillId(bill.id);
    setNewBillScope('private');
    setNewBillName(bill.name);
    setNewBillDefault(bill.defaultAmount ? bill.defaultAmount.toString() : '');
    setNewBillInterval(bill.interval || 'all');
    setNewBillCustomMonths(bill.customMonths || []);
    setNewBillWarn(bill.warnIfZero || false);
    setNewBillIsLoan(bill.isLoan || false);
    setNewBillTotalDebt(bill.totalDebt !== undefined ? bill.totalDebt.toString() : '');
    
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingBillId(null);
    setNewBillScope('shared');
    setNewBillName('');
    setNewBillDefault('');
    setNewBillWarn(false);
    setNewBillIsLoan(false);
    setNewBillTotalDebt('');
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
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="settings-tabs-desktop" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
          <button 
            onClick={() => setActiveTab('bills')}
            style={{ background: activeTab === 'bills' ? 'rgba(99,102,241,0.15)' : 'transparent', border: activeTab === 'bills' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', borderRadius: '8px', color: activeTab === 'bills' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'bills' ? 'bold' : 'normal', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', padding: '0.4rem 0.8rem', flexShrink: 0 }}
          >
            📋 Räkningar
          </button>
          <button 
            onClick={() => setActiveTab('accounts')}
            style={{ background: activeTab === 'accounts' ? 'rgba(99,102,241,0.15)' : 'transparent', border: activeTab === 'accounts' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', borderRadius: '8px', color: activeTab === 'accounts' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'accounts' ? 'bold' : 'normal', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', padding: '0.4rem 0.8rem', flexShrink: 0 }}
          >
            🏦 Konton
          </button>
          <button 
            onClick={() => setActiveTab('locks')}
            style={{ background: activeTab === 'locks' ? 'rgba(99,102,241,0.15)' : 'transparent', border: activeTab === 'locks' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', borderRadius: '8px', color: activeTab === 'locks' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'locks' ? 'bold' : 'normal', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', padding: '0.4rem 0.8rem', flexShrink: 0 }}
          >
            🔒 Lås upp
          </button>
          <button 
            onClick={() => setActiveTab('general')}
            style={{ background: activeTab === 'general' ? 'rgba(99,102,241,0.15)' : 'transparent', border: activeTab === 'general' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', borderRadius: '8px', color: activeTab === 'general' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'general' ? 'bold' : 'normal', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', padding: '0.4rem 0.8rem', flexShrink: 0 }}
          >
            ⚙️ Allmänt
          </button>
        </div>
        <div className="settings-tabs-mobile" style={{ marginBottom: '1.5rem' }}>
          <select 
            value={activeTab} 
            onChange={(e) => setActiveTab(e.target.value as 'bills' | 'accounts' | 'locks' | 'general')}
            style={{ width: '100%', padding: '0.8rem', fontSize: '1.05rem', background: 'rgba(0,0,0,0.4)', color: 'var(--text-primary)', border: '1px solid var(--accent-color)', borderRadius: '8px', cursor: 'pointer', appearance: 'auto' }}
          >
            <option value="bills">📋 Hantera Räkningar</option>
            <option value="accounts">🏦 Hantera Konton</option>
            <option value="locks">🔒 Lås upp månader</option>
            <option value="general">⚙️ Allmänna inställningar</option>
          </select>
        </div>
      </div>

      {activeTab === 'general' && (
        <div>
          <h3 className="card-title">Allmänna inställningar</h3>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-primary)' }}>
              <input 
                type="checkbox" 
                checked={state.settings?.showSummary !== false} 
                onChange={(e) => onUpdateSettings({ showSummary: e.target.checked })}
                style={{ width: '1.5rem', height: '1.5rem', cursor: 'pointer' }}
              />
              Visa sammanställning (Swish & Överföringar) högst upp i månadsvyn
            </label>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginLeft: '2.5rem', fontSize: '0.9rem' }}>
              Om du stänger av detta döljs rutorna som räknar ut vem som ska betala vad. Appen fungerar då mer som en klassisk utgiftskoll utan Swish-funktion.
            </p>
          </div>
        </div>
      )}

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
          <h3 className="card-title">Lås upp stängda månader/konton</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            När du trycker på "Markera som överfört" eller "Markera som klar" så låses siffrorna för den månaden. Här kan du låsa upp konton och månader om du behöver rätta till något.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Gemensam Månadsvy</h4>
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
                    <div key={monthId} className="card" style={{ marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', padding: '1rem' }}>
                      <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-color)' }}>{monthId}</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>Inga låsta konton hittades i månadsvyn.</div>
                ) : null}
              </div>
            </div>

            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Mina Privata Lås</h4>
              <div className="bill-list">
                {Object.keys(state.privateMonths || {}).sort().reverse().map(monthId => {
                  const mData = state.privateMonths![monthId];
                  if (!mData.isLocked) return null;

                  return (
                    <div key={monthId} className="card" style={{ marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, color: 'var(--accent-color)' }}>{monthId} 🔒</h4>
                        <button 
                          onClick={() => onUnlockPrivateMonth(monthId)}
                          style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid #3b82f6', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          🔓 Lås upp
                        </button>
                      </div>
                    </div>
                  );
                })}

                {Object.keys(state.privateMonths || {}).length === 0 || !Object.values(state.privateMonths || {}).some(m => m.isLocked) ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>Inga låsta privata månader hittades.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bills' && (
        <div>
          <h3 className="card-title">Gemensamma Räkningar (Månadsvyn)</h3>
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
                    <div className="bill-name">
                      {bill.name} {bill.isLoan && '💳 Lån'} {bill.warnIfZero && '⚠️ Varning'}
                    </div>
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

          {(state.privateBills || []).filter(b => b.userId === user?.id).length > 0 && (
            <>
              <h3 className="card-title">Mina Privata Räkningar (Privata vyn)</h3>
              <div className="bill-list" style={{ marginBottom: '2rem' }}>
                {(state.privateBills || []).filter(b => b.userId === user?.id).map(bill => {
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
                        <div className="bill-name">
                          {bill.name} {bill.isLoan && '💳 Lån'} {bill.warnIfZero && '⚠️ Varning'}
                        </div>
                        <div className="bill-meta">Privat • {intervalText}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => handleEditPrivateBill(bill)}
                          style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Ändra
                        </button>
                        <button 
                          onClick={() => onRemovePrivateBill(bill.id)}
                          style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Ta bort
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <h3 className="card-title">{editingBillId ? 'Ändra Räkning' : 'Lägg till ny räkning'}</h3>
          <div style={{ display: 'grid', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: editingBillId ? '2px solid var(--accent-color)' : 'none' }}>
            
            {!editingBillId && (
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                <button 
                  onClick={() => setNewBillScope('shared')}
                  style={{ flex: 1, padding: '0.75rem', background: newBillScope === 'shared' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', color: newBillScope === 'shared' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: newBillScope === 'shared' ? 'bold' : 'normal' }}
                >
                  Gemensam Räkning
                </button>
                <button 
                  onClick={() => setNewBillScope('private')}
                  style={{ flex: 1, padding: '0.75rem', background: newBillScope === 'private' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', color: newBillScope === 'private' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: newBillScope === 'private' ? 'bold' : 'normal' }}
                >
                  🔒 Privat Räkning
                </button>
              </div>
            )}

            <input 
              type="text" 
              placeholder="Namn (t.ex. Bredband)" 
              value={newBillName} 
              onChange={e => setNewBillName(e.target.value)} 
            />
            
            {newBillScope === 'shared' && (
              <>
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
              </>
            )}

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

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              <input 
                type="checkbox" 
                checked={newBillIsLoan} 
                onChange={e => {
                  setNewBillIsLoan(e.target.checked);
                  if (!e.target.checked) setNewBillTotalDebt('');
                }} 
                style={{ width: 'auto' }}
              />
              💳 Detta är en skuld/ett lån som ska betalas av över tid
            </label>

            {newBillIsLoan && (
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-color)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  Ange den <strong>ursprungliga totala skulden</strong> här. Appen kommer automatiskt att räkna ihop alla inmatade belopp över alla låsta månader och visa hur mycket du har betalat av i EkonomiTB.
                </p>
                <input 
                  type="number" 
                  placeholder="Total ursprunglig skuld (t.ex. 15000)" 
                  value={newBillTotalDebt} 
                  onChange={e => setNewBillTotalDebt(e.target.value)} 
                  style={{ width: '100%', marginBottom: 0 }}
                />
              </div>
            )}

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
