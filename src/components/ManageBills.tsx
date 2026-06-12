import { useState } from 'react';
import type { BillDefinition, PaymentInterval, PrivateBill } from '../types';
import { useStore } from '../store';
import { createPortal } from 'react-dom';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';

export default function ManageBills() {
  const { user, role } = useAuth();
  const state = useStore(s => s.state);
  const onAddBill = useStore(s => s.addBill);
  const onRemoveBill = useStore(s => s.removeBill);
  const onUpdateBill = useStore(s => s.updateBill);
  const onAddPrivateBill = useStore(s => s.addPrivateBill);
  const onRemovePrivateBill = useStore(s => s.removePrivateBill);
  const onUpdatePrivateBill = useStore(s => s.updatePrivateBill);
  const onAddAccount = useStore(s => s.addAccount);
  const onRemoveAccount = useStore(s => s.removeAccount);
  const onUnlockAccount = useStore(s => s.unlockAccount);
  const onUpdateSettings = useStore(s => s.updateSettings);
  const onUnlockPrivateMonth = useStore(s => s.togglePrivateLock);
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
  const [newBillAutoTransfer, setNewBillAutoTransfer] = useState<string>('');

  // Raderingsbekräftelse
  const [billToDelete, setBillToDelete] = useState<{ id: string, type: 'shared' | 'private' } | null>(null);

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
        id: editingBillId || crypto.randomUUID(),
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
        id: editingBillId || crypto.randomUUID(),
        name: newBillName,
        accountId: newBillAccount,
        splitType: newBillSplit,
        defaultAmount: newBillDefault === '' ? 0 : parseFloat(newBillDefault),
        interval: newBillInterval,
        customMonths: newBillInterval === 'custom' ? newBillCustomMonths : undefined,
        warnIfZero: newBillWarn,
        isLoan: newBillIsLoan,
        totalDebt: newBillTotalDebt === '' ? undefined : parseFloat(newBillTotalDebt),
        isAutoTransfer: newBillAutoTransfer || undefined
      };
      if (editingBillId) {
        onUpdateBill(billData);
      } else {
        onAddBill(billData);
      }
    }
    
    const wasEditing = !!editingBillId;
    
    if (!wasEditing) {
      setEditingBillId(null);
      setNewBillName('');
      setNewBillDefault('');
      setNewBillWarn(false);
      setNewBillIsLoan(false);
      setNewBillTotalDebt('');
      setNewBillAutoTransfer('');
      setNewBillInterval('all');
      setNewBillCustomMonths([]);
    }

    toast.success(wasEditing ? '✅ Räkning sparad!' : '✅ Räkning tillagd!');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setNewBillAutoTransfer(bill.isAutoTransfer || '');
    
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

  const handleConfirmDelete = async () => {
    if (!billToDelete) return;
    if (billToDelete.type === 'shared') {
      onRemoveBill(billToDelete.id);
    } else {
      onRemovePrivateBill(billToDelete.id);
    }
    setBillToDelete(null);
    toast.success('✅ Räkning borttagen!');
  };

  const handleCancelEdit = () => {
    setEditingBillId(null);
    setNewBillScope('shared');
    setNewBillName('');
    setNewBillDefault('');
    setNewBillWarn(false);
    setNewBillIsLoan(false);
    setNewBillTotalDebt('');
    setNewBillAutoTransfer('');
    setNewBillInterval('all');
    setNewBillCustomMonths([]);
  };

  const handleAddAccount = () => {
    if (!newAccName.trim()) return;
    onAddAccount({
      id: crypto.randomUUID(),
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
            onClick={() => setActiveTab('locks')}
            style={{ background: activeTab === 'locks' ? 'rgba(99,102,241,0.15)' : 'transparent', border: activeTab === 'locks' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', borderRadius: '8px', color: activeTab === 'locks' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'locks' ? 'bold' : 'normal', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', padding: '0.4rem 0.8rem', flexShrink: 0 }}
          >
            🔓 Lås upp
          </button>
          {role === 'owner' && (
            <>
              <button 
                onClick={() => setActiveTab('accounts')}
                style={{ background: activeTab === 'accounts' ? 'rgba(99,102,241,0.15)' : 'transparent', border: activeTab === 'accounts' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', borderRadius: '8px', color: activeTab === 'accounts' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'accounts' ? 'bold' : 'normal', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', padding: '0.4rem 0.8rem', flexShrink: 0 }}
              >
                🏦 Konton
              </button>
              <button 
                onClick={() => setActiveTab('general')}
                style={{ background: activeTab === 'general' ? 'rgba(99,102,241,0.15)' : 'transparent', border: activeTab === 'general' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', borderRadius: '8px', color: activeTab === 'general' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'general' ? 'bold' : 'normal', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', padding: '0.4rem 0.8rem', flexShrink: 0 }}
              >
                ⚙️ Allmänt
              </button>
            </>
          )}
        </div>
        <div className="settings-tabs-mobile" style={{ marginBottom: '1.5rem' }}>
          <select 
            value={activeTab} 
            onChange={(e) => setActiveTab(e.target.value as 'bills' | 'accounts' | 'locks' | 'general')}
            style={{ width: '100%', padding: '0.8rem', fontSize: '1.05rem', background: 'rgba(0,0,0,0.4)', color: 'var(--text-primary)', border: '1px solid var(--accent-color)', borderRadius: '8px', cursor: 'pointer', appearance: 'auto' }}
          >
            <option value="bills">📋 Hantera Räkningar</option>
            <option value="locks">🔒 Lås upp månader</option>
            {role === 'owner' && <option value="accounts">🏦 Hantera Konton</option>}
            {role === 'owner' && <option value="general">⚙️ Allmänna inställningar</option>}
          </select>
        </div>
      </div>

      {activeTab === 'general' && (
        <div>
          <h3 className="card-title">Allmänna inställningar</h3>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={(state.settings?.showTransferSummary ?? state.settings?.showSummary) !== false} 
                  onChange={(e) => onUpdateSettings({ showTransferSummary: e.target.checked })}
                  style={{ width: '1.5rem', height: '1.5rem', cursor: 'pointer' }}
                />
                Visa sammanställning för Överföringar högst upp i månadsvyn
              </label>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginLeft: '2.5rem', fontSize: '0.9rem' }}>
                Visar en ruta med vem som ska föra över pengar till gemensamma konton.
              </p>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={(state.settings?.showSwishSummary ?? state.settings?.showSummary) !== false} 
                  onChange={(e) => onUpdateSettings({ showSwishSummary: e.target.checked })}
                  style={{ width: '1.5rem', height: '1.5rem', cursor: 'pointer' }}
                />
                Visa sammanställning för Swish högst upp i månadsvyn
              </label>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginLeft: '2.5rem', fontSize: '0.9rem' }}>
                Visar en ruta med vem som är skyldig vem pengar (Swish personer emellan).
              </p>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={state.settings?.enableManagementButtons !== false} 
                  onChange={(e) => onUpdateSettings({ enableManagementButtons: e.target.checked })}
                  style={{ width: '1.5rem', height: '1.5rem', cursor: 'pointer' }}
                />
                Visa hanteringsknappar (Lås & Hanterat)
              </label>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginLeft: '2.5rem', fontSize: '0.9rem' }}>
                Om du bockar ur detta döljs alla knappar för att markera överföringar och totalbelopp som klara. Push-notiser stängs då också av. Appen fungerar då mer som en klassisk utgiftskoll.
              </p>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={state.settings?.showTopTotal === true} 
                  onChange={(e) => onUpdateSettings({ showTopTotal: e.target.checked })}
                  style={{ width: '1.5rem', height: '1.5rem', cursor: 'pointer' }}
                />
                Visa totala summan på alla räkningar högst upp i gemensam vy
              </label>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginLeft: '2.5rem', fontSize: '0.9rem' }}>
                Visar en stor ruta längst upp med månadens sammanlagda kostnader i Gemensam vy.
              </p>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={state.settings?.showPrivateTopTotal === true} 
                  onChange={(e) => onUpdateSettings({ showPrivateTopTotal: e.target.checked })}
                  style={{ width: '1.5rem', height: '1.5rem', cursor: 'pointer' }}
                />
                Visa totala summan på alla räkningar högst upp i privat vy
              </label>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginLeft: '2.5rem', fontSize: '0.9rem' }}>
                Visar en stor ruta längst upp med månadens sammanlagda kostnader i Privat vy.
              </p>
            </div>


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
                  <div className="bill-meta">{acc.type === 'shared' ? 'Gemensamt konto' : 'Personligt konto'} • Betalningsmetod: {acc.transferMethod === 'transfer' ? 'Banköverföring' : 'Swish'}</div>
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
              <option value="swish">Betalningsmetod: Swish</option>
              <option value="transfer">Betalningsmetod: Banköverföring</option>
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

                  if (lockedAccounts.size === 0 && !handled['top_total_lock']) return null;

                  return (
                    <div key={monthId} className="card" style={{ marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', padding: '1rem' }}>
                      <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-color)' }}>{monthId}</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {handled['top_total_lock'] && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-color)', padding: '0.75rem', borderRadius: '8px' }}>
                            <span>Total kostnad (Hela månaden) 🔒</span>
                            <button 
                              onClick={() => onUnlockAccount(monthId, 'top_total_only')}
                              style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid #3b82f6', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              🔓 Lås upp
                            </button>
                          </div>
                        )}
                        {state.accounts.map(acc => {
                          if (acc.type === 'shared') return null;
                          
                          let isIndividuallyLocked = false;
                          Object.keys(handled).forEach(paymentId => {
                            if (handled[paymentId] && paymentId !== 'top_total_lock') {
                              if (paymentId.includes(acc.id)) isIndividuallyLocked = true;
                            }
                          });

                          if (!isIndividuallyLocked) return null;
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
            {state.bills.filter(b => !b.isArchived).map(bill => {
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
                      {bill.name} {bill.isLoan && '💳 Lån'} {bill.warnIfZero && '⚠️ Varning'} {bill.isAutoTransfer && <span style={{ color: '#34d399', fontSize: '0.8rem' }}>↩️ Auto-överföring</span>}
                    </div>
                    <div className="bill-meta">{account?.name} • {splitText} • {intervalText}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {role === 'owner' && (
                      <>
                        <button 
                          onClick={() => handleEditBill(bill)}
                          style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Ändra
                        </button>
                        <button 
                          onClick={() => setBillToDelete({ id: bill.id, type: 'shared' })}
                          style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Ta bort
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {(state.privateBills || []).filter(b => b.userId === user?.id && !b.isArchived).length > 0 && (
            <>
              <h3 className="card-title">Privata Räkningar</h3>
              <div className="bill-list" style={{ marginBottom: '2rem' }}>
                {(state.privateBills || []).filter(b => b.userId === user?.id && !b.isArchived).map(bill => {
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
                          onClick={() => setBillToDelete({ id: bill.id, type: 'private' })}
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

            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Skriv namn eller välj i listan 👉" 
                  value={newBillName} 
                  onChange={e => setNewBillName(e.target.value)} 
                  style={{ flex: 1, marginBottom: 0 }}
                />
                <select 
                  value="" 
                  onChange={e => {
                    if (e.target.value) {
                      setNewBillName(e.target.value);
                    }
                  }}
                  style={{ flex: 1, marginBottom: 0 }}
                >
                  <option value="" disabled>Vanliga räkningar...</option>
                  <option value="Hyra">🏠 Hyra</option>
                  <option value="Lån">🏦 Lån</option>
                  <option value="El">⚡ El</option>
                  <option value="Vatten">💧 Vatten</option>
                  <option value="Bredband">🌐 Bredband</option>
                  <option value="Hemförsäkring">🛡️ Hemförsäkring</option>
                  <option value="Bilförsäkring">🚗 Bilförsäkring</option>
                  <option value="Netflix">🎬 Netflix</option>
                  <option value="Spotify">🎵 Spotify</option>
                  <option value="Fjärrvärme">🔥 Fjärrvärme</option>
                  <option value="Sophämtning">🗑️ Sophämtning</option>
                  <option value="CSN">🎓 CSN</option>
                  <option value="Mobilabonnemang">📱 Mobilabonnemang</option>
                  <option value="A-kassa / Fack">💼 A-kassa / Fack</option>
                  <option value="Gymkort">🏋️ Gymkort</option>
                </select>
              </div>
            </div>
            
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

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
              <input 
                type="checkbox" 
                checked={newBillWarn} 
                onChange={e => setNewBillWarn(e.target.checked)} 
                style={{ width: 'auto' }}
              />
              Varna med röd färg om jag glömmer fylla i denna (När den förväntas)
            </label>

            {newBillWarn && (
              <div style={{ paddingLeft: '1.5rem', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                <select value={newBillInterval} onChange={e => setNewBillInterval(e.target.value as PaymentInterval)} style={{ width: '100%', marginBottom: newBillInterval === 'custom' ? '0.5rem' : 0 }}>
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
              </div>
            )}

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
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-color)', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
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

            {newBillScope === 'shared' && (
              <div style={{ marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input 
                    type="checkbox" 
                    checked={newBillAutoTransfer !== ''} 
                    onChange={e => setNewBillAutoTransfer(e.target.checked ? 'all' : '')} 
                    style={{ width: 'auto' }}
                  />
                  ↩️ Automatisk överföring (räknas bort från summan "att föra över")
                </label>
                
                {newBillAutoTransfer !== '' && (
                  <div style={{ marginTop: '0.8rem', marginLeft: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: '2px solid var(--accent-color)' }}>
                    <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Vem har autogiro / vem gäller detta för?</label>
                    <select 
                      value={newBillAutoTransfer} 
                      onChange={e => setNewBillAutoTransfer(e.target.value)}
                      style={{ marginBottom: '0.5rem' }}
                    >
                      <option value="all">Alla (Pengarna räknas bort för alla)</option>
                      {state.accounts.filter(a => a.type === 'person').map(acc => (
                        <option key={acc.id} value={acc.id}>
                          Bara {acc.name} (Räknas endast bort för {acc.name})
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {newBillAutoTransfer === 'all' && '✅ Ingen behöver föra över – allt sköts automatiskt.'}
                      {newBillAutoTransfer !== 'all' && `✅ Bara ${state.accounts.find(a => a.id === newBillAutoTransfer)?.name || '?'} slipper föra över sin andel – de andra måste fortfarande göra det manuellt.`}
                    </div>
                  </div>
                )}
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

      {/* Raderingsmodal */}
      {billToDelete && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 99999 }}>
          <div className="card" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: '400px', width: '90%', border: '1px solid #f43f5e', background: '#111', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', margin: 0, padding: '1.5rem' }}>
            <h3 style={{ color: '#f43f5e', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⚠️</span> Är du säker?
            </h3>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
              När du raderar denna räkning kommer den att döljas för alla framtida månader, men historiken sparas så att gamla grafer och sammanställningar fortfarande stämmer.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setBillToDelete(null)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Avbryt
              </button>
              <button 
                onClick={handleConfirmDelete}
                style={{ flex: 1, background: '#f43f5e', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Ja, radera den
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
