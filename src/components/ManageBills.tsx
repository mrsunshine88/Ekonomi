import { useState, useEffect } from 'react';
import type { BillDefinition, PaymentInterval, PrivateBill } from '../types';
import { useStore } from '../store';
import { createPortal } from 'react-dom';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';
import * as xlsx from 'xlsx';

export default function ManageBills() {
  const { user: realUser, role } = useAuth();
  const isDemoMode = useStore(s => s.isDemoMode);
  const user = isDemoMode ? { id: 'demo_user_1', email: 'demo@smartekonomi.se' } : realUser;
  
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
  const saveIncome = useStore(s => s.saveIncome);
  const removeIncome = useStore(s => s.removeIncome);
  const householdProfiles = useStore(s => s.state.householdProfiles) || [];
  const updateProfileAccount = useStore(s => s.updateProfileAccount);
  const personAccounts = state.accounts.filter(a => a.type === 'person');
  const [activeTab, setActiveTab] = useState<'bills' | 'accounts' | 'locks' | 'general' | 'salary'>(() => {
    return (localStorage.getItem('settingsActiveTab') as any) || 'bills';
  });

  useEffect(() => {
    localStorage.setItem('settingsActiveTab', activeTab);
  }, [activeTab]);
  
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
  const [newBillFixedFee, setNewBillFixedFee] = useState('');
  const [newBillAutoTransfer, setNewBillAutoTransfer] = useState<string>('');

  // Raderingsbekräftelse
  const [billToDelete, setBillToDelete] = useState<{ id: string, type: 'shared' | 'private' } | null>(null);

  // New Account State
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'shared' | 'person'>('person');
  const [newAccTransferMethod, setNewAccTransferMethod] = useState<'transfer' | 'swish'>('swish');
  
  const [variableIncomeDate, setVariableIncomeDate] = useState('');
  const [variableIncomeAmount, setVariableIncomeAmount] = useState('');
  const [variableIncomeName, setVariableIncomeName] = useState('');

  const [fixedIncomeName, setFixedIncomeName] = useState('');
  const [fixedIncomeAmount, setFixedIncomeAmount] = useState('');

  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);

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
        totalDebt: newBillTotalDebt === '' ? undefined : parseFloat(newBillTotalDebt),
        fixedFee: newBillFixedFee === '' ? 0 : parseFloat(newBillFixedFee)
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
        fixedFee: newBillFixedFee === '' ? 0 : parseFloat(newBillFixedFee),
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
      setNewBillFixedFee('');
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
    setNewBillFixedFee(bill.fixedFee !== undefined ? bill.fixedFee.toString() : '');
    setNewBillAutoTransfer(bill.isAutoTransfer || '');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setNewBillFixedFee(bill.fixedFee !== undefined ? bill.fixedFee.toString() : '');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = xlsx.read(data, { type: 'array' });
        
        let json: any[][] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const sheetJson = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          
          let hasKategori = false;
          for (let i = 0; i < Math.min(15, sheetJson.length); i++) {
            if (sheetJson[i] && sheetJson[i].some(cell => typeof cell === 'string' && cell.toLowerCase().includes('kategori'))) {
              hasKategori = true;
              break;
            }
          }
          if (hasKategori) {
            json = sheetJson;
            break;
          }
        }

        // Om ingen flik hade 'Kategori', ta första fliken som fallback
        if (json.length === 0 && workbook.SheetNames.length > 0) {
          json = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as any[][];
        }
        
        if (json.length < 2) {
          toast.error("Excel-filen är för kort eller tom.");
          return;
        }

        // Hitta header raden. Vi antar rad 3 baserat på bilden (index 2), eller letar efter "Kategori"
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(10, json.length); i++) {
          if (json[i].some(cell => typeof cell === 'string' && cell.toLowerCase().includes('kategori'))) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) {
          toast.error("Hittade inte rubriken 'Kategori' i filen.");
          return;
        }

        const headers = json[headerRowIdx].map(h => typeof h === 'string' ? h.toLowerCase() : '');
        const kategoriIdx = headers.findIndex(h => h.includes('kategori'));
        const rakningIdx = headers.findIndex(h => h.includes('räkning'));
        
        // Hitta första månaden (första kolumnen med "belopp" under en månad). I bilden är belopp under Januari och Februari.
        // Så vi letar efter en kolumn som har nummer värden
        let firstAmountIdx = -1;
        for(let i = Math.max(kategoriIdx, rakningIdx) + 1; i < headers.length; i++) {
            if (headers[i].includes('belopp')) {
                firstAmountIdx = i;
                break;
            }
        }
        
        if (firstAmountIdx === -1) {
            // Fallback: Ta kolumnen efter "räkning" om belopp inte finns
            firstAmountIdx = rakningIdx + 1;
        }

        if (kategoriIdx === -1 || rakningIdx === -1) {
          toast.error("Saknar kolumner för 'Kategori' eller 'Räkning'.");
          return;
        }

        let addedCount = 0;
        let currentCategory = "";
        const newAccountsCache: Record<string, any> = {};

        for (let i = headerRowIdx + 1; i < json.length; i++) {
          const row = json[i];
          if (!row || row.length === 0) continue;

          let category = row[kategoriIdx];
          if (category && typeof category === 'string' && category.trim() !== '') {
            currentCategory = category.trim();
          }

          const rakning = row[rakningIdx];
          if (!rakning || typeof rakning !== 'string' || rakning.trim() === '' || rakning.toLowerCase() === 'totalt' || rakning.toLowerCase() === 'andreas' || rakning.toLowerCase() === 'helena') {
            continue; // Skippa summeringar och tomma rader
          }

          let amountStr = row[firstAmountIdx];
          let amount = 0;
          if (typeof amountStr === 'number') {
            amount = amountStr;
          } else if (typeof amountStr === 'string') {
             amount = parseFloat(amountStr.replace(/[^0-9,-]+/g, '').replace(',', '.'));
             if (isNaN(amount)) amount = 0;
          }

          // Kontrollera om kontot finns (både i state och nyss skapade under loopen)
          let account = state.accounts.find(a => a.name.toLowerCase() === currentCategory.toLowerCase()) || 
                        Object.values(newAccountsCache).find((a: any) => a.name.toLowerCase() === currentCategory.toLowerCase());
                        
          if (!account) {
            // Avgör typ: Innehåller "konto" -> oftast person eller gemensamt. Vi kan defaulta till 'shared'.
            account = {
              id: crypto.randomUUID(),
              name: currentCategory,
              type: 'shared',
              transferMethod: 'transfer'
            };
            newAccountsCache[account.id] = account;
            await onAddAccount(account);
          }

          const billData: BillDefinition = {
            id: crypto.randomUUID(),
            name: rakning.trim(),
            accountId: account.id,
            splitType: 'equal', // Default
            defaultAmount: amount,
            interval: 'all',
            warnIfZero: true
          };
          await onAddBill(billData);
          addedCount++;
        }

        toast.success(`✅ Importerade ${addedCount} räkningar från Excel!`);
        if (e.target) e.target.value = ''; // Nollställ
      } catch (err) {
        console.error(err);
        toast.error("Kunde inte läsa in Excel-filen.");
      }
    };
    reader.readAsArrayBuffer(file);
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
          <button 
            onClick={() => setActiveTab('salary')}
            style={{ background: activeTab === 'salary' ? 'rgba(99,102,241,0.15)' : 'transparent', border: activeTab === 'salary' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', borderRadius: '8px', color: activeTab === 'salary' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'salary' ? 'bold' : 'normal', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', padding: '0.4rem 0.8rem', flexShrink: 0 }}
          >
            💰 Inkomster
          </button>
        </div>
        <div className="settings-tabs-mobile" style={{ marginBottom: '1.5rem' }}>
          <select 
            value={activeTab} 
            onChange={(e) => setActiveTab(e.target.value as 'bills' | 'accounts' | 'locks' | 'general' | 'salary')}
            style={{ width: '100%', padding: '0.8rem', fontSize: '1.05rem', background: 'rgba(0,0,0,0.4)', color: 'var(--text-primary)', border: '1px solid var(--accent-color)', borderRadius: '8px', cursor: 'pointer', appearance: 'auto' }}
          >
            <option value="bills">📋 Hantera Räkningar</option>
            <option value="locks">🔒 Lås upp månader</option>
            {role === 'owner' && <option value="accounts">🏦 Hantera Konton</option>}
            {role === 'owner' && <option value="general">⚙️ Allmänna inställningar</option>}
            <option value="salary">💰 Mina Inkomster</option>
          </select>
        </div>
      </div>

      {activeTab === 'salary' && (
        <div>
          <h3 className="card-title">Mina Inkomster</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Fasta Inkomster */}
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Fast Inkomst (Varje månad)</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Exempel: Barnbidrag, Underhåll. Läggs automatiskt på <strong>varje månad</strong> i kalkylen.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                <input 
                  type="text" 
                  value={fixedIncomeName}
                  onChange={e => setFixedIncomeName(e.target.value)}
                  placeholder="Namn (t.ex. Barnbidrag)"
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="number" 
                    value={fixedIncomeAmount}
                    onChange={e => setFixedIncomeAmount(e.target.value)}
                    placeholder="Summa"
                    style={{ flex: 1 }}
                  />
                  <button 
                    onClick={() => {
                       const amt = parseFloat(fixedIncomeAmount);
                       if (fixedIncomeName.trim() && !isNaN(amt)) {
                         saveIncome({ id: editingIncomeId || undefined, name: fixedIncomeName, amount: amt, type: 'fixed' });
                         toast.success('Fast inkomst sparad!');
                         setFixedIncomeName('');
                         setFixedIncomeAmount('');
                         setEditingIncomeId(null);
                       }
                    }}
                    className="btn-primary"
                    style={{ minWidth: '100px' }}
                  >
                    Spara
                  </button>
                </div>
              </div>
              
              <div style={{ marginTop: '1rem' }}>
                {state.incomes?.filter(i => i.userId === user?.id && i.type === 'fixed').map(inc => (
                  <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{inc.name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>{inc.amount.toLocaleString('sv-SE')} kr</span>
                      <button 
                        onClick={() => {
                          setFixedIncomeName(inc.name);
                          setFixedIncomeAmount(inc.amount.toString());
                          setEditingIncomeId(inc.id);
                        }}
                        style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Ändra
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm('Är du säker på att du vill ta bort inkomsten?')) {
                            await removeIncome(inc.id);
                            toast.success('Inkomst borttagen');
                          }
                        }}
                        style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rörliga Inkomster */}
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Rörlig Inkomst (Specifikt datum)</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Exempel: Lön, Försäkringskassan. Kopplas automatiskt till <strong>månaden efter</strong> datumet du väljer.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                <input 
                  type="text" 
                  value={variableIncomeName}
                  onChange={e => setVariableIncomeName(e.target.value)}
                  placeholder="Namn (t.ex. Lön)"
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input 
                    type="date" 
                    value={variableIncomeDate}
                    onChange={e => setVariableIncomeDate(e.target.value)}
                    style={{ flex: 1, minWidth: '130px' }}
                  />
                  <input 
                    type="number" 
                    value={variableIncomeAmount}
                    onChange={e => setVariableIncomeAmount(e.target.value)}
                    placeholder="Summa"
                    style={{ flex: 1, minWidth: '100px' }}
                  />
                  <button 
                    onClick={() => {
                       const amt = parseFloat(variableIncomeAmount);
                       if (variableIncomeName.trim() && variableIncomeDate && !isNaN(amt)) {
                         saveIncome({ id: editingIncomeId || undefined, name: variableIncomeName, amount: amt, type: 'variable', payDate: variableIncomeDate });
                         toast.success('Rörlig inkomst sparad!');
                         setVariableIncomeName('');
                         setVariableIncomeAmount('');
                         setVariableIncomeDate('');
                         setEditingIncomeId(null);
                       }
                    }}
                    className="btn-primary"
                    style={{ minWidth: '80px' }}
                  >
                    Spara
                  </button>
                </div>
              </div>
              
              <div style={{ marginTop: '1rem' }}>
                {state.incomes?.filter(i => i.userId === user?.id && i.type === 'variable').sort((a,b) => (b.payDate||'').localeCompare(a.payDate||'')).map(inc => {
                   const d = new Date(inc.payDate!);
                   const nextMonthDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
                   const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
                   return (
                     <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <div>
                         <div style={{ fontWeight: 'bold' }}>{inc.name} ({inc.payDate})</div>
                         <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Används för {nextMonthStr}</div>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                         <span style={{ color: '#10b981', fontWeight: 'bold' }}>{inc.amount.toLocaleString('sv-SE')} kr</span>
                         <button 
                           onClick={() => {
                             setVariableIncomeName(inc.name);
                             setVariableIncomeDate(inc.payDate!);
                             setVariableIncomeAmount(inc.amount.toString());
                             setEditingIncomeId(inc.id);
                           }}
                           style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                         >
                           Ändra
                         </button>
                         <button 
                           onClick={async () => {
                             if (confirm('Är du säker på att du vill ta bort inkomsten?')) {
                               await removeIncome(inc.id);
                               toast.success('Inkomst borttagen');
                             }
                           }}
                           style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                         >
                           Ta bort
                         </button>
                       </div>
                     </div>
                   );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'general' && (
        <div>
          <h3 className="card-title">Allmänna inställningar</h3>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={state.settings?.showTransferSummary === true} 
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
                  checked={state.settings?.showSwishSummary === true} 
                  onChange={(e) => onUpdateSettings({ showSwishSummary: e.target.checked })}
                  style={{ width: '1.5rem', height: '1.5rem', cursor: 'pointer' }}
                />
                Visa sammanställning för personliga överföringar högst upp i månadsvyn
              </label>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginLeft: '2.5rem', fontSize: '0.9rem' }}>
                Visar en ruta med vem som är skyldig vem pengar (överföringar personer emellan).
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
                  checked={state.settings?.showTopTotal !== false} 
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
          <h3 className="card-title">Lägg till nytt konto</h3>
          <div style={{ display: 'grid', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 'bold' }}>1. Vad vill du lägga till?</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <button
                  onClick={() => {
                    setNewAccType('person');
                    setNewAccTransferMethod('swish');
                  }}
                  style={{
                    background: newAccType === 'person' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
                    border: newAccType === 'person' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                    color: newAccType === 'person' ? '#fff' : 'var(--text-primary)',
                    padding: '1rem', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem'
                  }}
                >
                  <strong style={{ fontSize: '1.05rem' }}>👤 Lägg till en Person (Hushållsmedlem)</strong>
                  <span style={{ fontSize: '0.85rem', color: newAccType === 'person' ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)', lineHeight: '1.4', fontWeight: 'normal' }}>
                    Lägg till dig själv och de andra i hushållet.<br/>
                    <em style={{ opacity: 0.8, fontSize: '0.8rem', marginTop: '0.4rem', display: 'block' }}>👉 Detta krävs för att appen ska räkna ut om ni är skyldiga varandra pengar (t.ex. "Andreas för över till Helena").</em>
                  </span>
                </button>

                <button
                  onClick={() => {
                    setNewAccType('shared');
                    setNewAccTransferMethod('transfer');
                  }}
                  style={{
                    background: newAccType === 'shared' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
                    border: newAccType === 'shared' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                    color: newAccType === 'shared' ? '#fff' : 'var(--text-primary)',
                    padding: '1rem', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem'
                  }}
                >
                  <strong style={{ fontSize: '1.05rem' }}>🏦 Lägg till ett Gemensamt Bankkonto / Kort</strong>
                  <span style={{ fontSize: '0.85rem', color: newAccType === 'shared' ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)', lineHeight: '1.4', fontWeight: 'normal' }}>
                    Ett gemensamt konto där ni sätter in pengar för räkningar och mat.<br/>
                    <em style={{ opacity: 0.8, fontSize: '0.8rem', marginTop: '0.4rem', display: 'block' }}>👉 Detta krävs för att se hur mycket ni ska sätta in (t.ex. "Andreas för över till Hus kontot").</em>
                  </span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 'bold' }}>2. Vad heter personen / kontot?</label>
              <input 
                type="text" 
                placeholder={newAccType === 'person' ? "T.ex. Johan eller Maria" : "T.ex. Hus kontot eller Ica-kortet"} 
                value={newAccName} 
                onChange={e => setNewAccName(e.target.value)} 
                style={{ padding: '0.8rem', fontSize: '1.05rem', marginBottom: 0 }}
              />
            </div>

            <button onClick={handleAddAccount} style={{ background: 'var(--success-color)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.05rem', marginTop: '1rem' }}>
              + Skapa Kontot
            </button>
          </div>

          <h3 className="card-title">Befintliga Konton</h3>
          <div className="bill-list" style={{ marginBottom: '2rem' }}>
            {[...state.accounts].sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(acc => (
              <div key={acc.id} className="bill-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div className="bill-name">{acc.name}</div>
                  <div className="bill-meta">{acc.type === 'shared' ? 'Gemensamt konto' : 'Personligt konto'}</div>
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
          
          {role === 'owner' && (
            <>
              <h3 className="card-title" style={{ marginTop: '2.5rem', paddingTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>Koppla Inlogg till Person</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Här väljer du vilken person i appen som tillhör vilken inloggad e-postadress. Detta krävs för att medlemmar ska se sina egna uträkningar.
              </p>
              <div className="bill-list" style={{ marginBottom: '2rem' }}>
                {householdProfiles.map(profile => (
                  <div key={profile.id} className="bill-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div className="bill-name">{profile.email} {profile.id === user?.id && '(Du)'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', flex: '1 1 auto' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Kopplat konto:</span>
                      <select
                        value={profile.person_account_id || ''}
                        onChange={(e) => updateProfileAccount(profile.id, e.target.value || null)}
                        style={{ flex: 1, padding: '0.4rem', borderRadius: '4px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.9rem', minWidth: '150px' }}
                      >
                        <option value="">-- Inget valt --</option>
                        {personAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
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
                        {Object.keys(handled).map(paymentId => {
                          if (!handled[paymentId] || paymentId === 'top_total_lock') return null;
                          
                          let label = '';
                          if (paymentId.startsWith('transfer_')) {
                            const parts = paymentId.split('_');
                            const person = state.accounts.find(a => a.id === parts[1]);
                            const shared = state.accounts.find(a => a.id === parts.slice(2).join('_'));
                            if (person && shared) label = `${person.name} för över till ${shared.name}`;
                          } else if (paymentId.startsWith('swish_')) {
                            const parts = paymentId.split('_');
                            let fromId, toId;
                            if (parts.length > 3 && parts[2] === 'to') {
                               fromId = parts[1];
                               toId = parts.slice(3).join('_');
                            } else {
                               fromId = parts[1];
                               toId = parts[2];
                            }
                            const fromPerson = state.accounts.find(a => a.id === fromId);
                            const toPerson = state.accounts.find(a => a.id === toId);
                            if (fromPerson && toPerson) label = `${fromPerson.name} för över till ${toPerson.name}`;
                          }
                          
                          if (!label) return null;

                          return (
                            <div key={paymentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-color)', padding: '0.75rem', borderRadius: '8px' }}>
                              <span>{label} 🔒</span>
                              <button 
                                onClick={() => useStore.getState().togglePaymentStatus(monthId, paymentId)}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ margin: 0 }}>{editingBillId ? 'Ändra Räkning' : 'Lägg till ny räkning'}</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <label style={{ cursor: 'pointer', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    📥 Importera Excel
                    <input type="file" accept=".xlsx, .xls, .xlsm" onChange={handleImportExcel} style={{ display: 'none' }} />
                </label>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', border: editingBillId ? '2px solid var(--accent-color)' : 'none' }}>
            
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
                  <option value="">Vanliga räkningar...</option>
                  <option value="Hyra">🏠 Hyra</option>
                  <option value="Lån">🏦 Lån</option>
                  <option value="Bolån">🏠 Bolån</option>
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
                  <option value="A-kassa">💼 A-kassa</option>
                  <option value="Fackförening">🤝 Fackförening</option>
                  <option value="Gymkort">🏋️ Gymkort</option>
                </select>
              </div>
            </div>
            
            {/* 1. Account & Split */}
            {newBillScope === 'shared' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Betalas från konto</label>
                  <select value={newBillAccount} onChange={e => setNewBillAccount(e.target.value)} style={{ width: '100%', marginBottom: 0 }}>
                    <option value="" disabled>-- Välj vilket konto räkningen dras ifrån --</option>
                    {[...state.accounts].sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
                
                {state.accounts.filter(a => a.type === 'person').length > 1 && (
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Hur ska räkningen delas?</label>
                    <select value={newBillSplit} onChange={e => setNewBillSplit(e.target.value)} style={{ width: '100%', marginBottom: 0 }}>
                      <option value="equal">Delas lika på alla personer (Gemensam)</option>
                      {state.accounts.filter(a => a.type === 'person').sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} betalar 100%</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* 2. Default Amount */}
            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Standardbelopp (Frivilligt)</label>
              <input 
                type="number" 
                placeholder="0" 
                value={newBillDefault} 
                onChange={e => setNewBillDefault(e.target.value)} 
                style={{ width: '100%' }}
              />
            </div>

            {/* 3. Smarta Inställningar */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>Smarta inställningar</h4>

              {/* Varning */}
              <div style={{ marginBottom: '1rem', background: newBillWarn ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: newBillWarn ? '1px solid #10b981' : '1px solid transparent', transition: 'all 0.2s' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={newBillWarn} 
                    onChange={e => setNewBillWarn(e.target.checked)} 
                    style={{ width: '1.2rem', height: '1.2rem', marginTop: '0.1rem', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ color: newBillWarn ? '#10b981' : 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.2rem' }}>Påminn mig om denna saknas</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Varnar med röd färg i månadsvyn om du glömmer fylla i den.</div>
                  </div>
                </label>

                {newBillWarn && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(16, 185, 129, 0.2)' }}>
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
              </div>

              {/* Lån */}
              <div style={{ marginBottom: '1rem', background: newBillIsLoan ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: newBillIsLoan ? '1px solid #3b82f6' : '1px solid transparent', transition: 'all 0.2s' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={newBillIsLoan} 
                    onChange={e => {
                      setNewBillIsLoan(e.target.checked);
                      if (!e.target.checked) {
                        setNewBillTotalDebt('');
                        setNewBillFixedFee('');
                      }
                    }} 
                    style={{ width: '1.2rem', height: '1.2rem', marginTop: '0.1rem', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ color: newBillIsLoan ? '#3b82f6' : 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.2rem' }}>Detta är ett lån / en skuld</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Hanteras separat för att betalas av över tid.</div>
                  </div>
                </label>

                {newBillIsLoan && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      Ange den <strong>ursprungliga totala skulden</strong> här. Appen räknar automatiskt ihop vad du betalat.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Total startskuld (kr)</label>
                        <input 
                          type="number" 
                          placeholder="T.ex. 10000" 
                          value={newBillTotalDebt} 
                          onChange={e => setNewBillTotalDebt(e.target.value)} 
                          style={{ width: '100%', marginBottom: 0 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Fast avgift / månad (kr)</label>
                        <input 
                          type="number" 
                          placeholder="T.ex. 50" 
                          value={newBillFixedFee} 
                          onChange={e => setNewBillFixedFee(e.target.value)} 
                          style={{ width: '100%', marginBottom: 0 }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Autogiro */}
              {newBillScope === 'shared' && (
                <div style={{ marginBottom: '1rem', background: newBillAutoTransfer !== '' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: newBillAutoTransfer !== '' ? '1px solid #f59e0b' : '1px solid transparent', transition: 'all 0.2s' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={newBillAutoTransfer !== ''} 
                      onChange={e => setNewBillAutoTransfer(e.target.checked ? 'all' : '')} 
                      style={{ width: '1.2rem', height: '1.2rem', marginTop: '0.1rem', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ color: newBillAutoTransfer !== '' ? '#f59e0b' : 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.2rem' }}>Dras via Autogiro</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Räknas bort från summan som du måste föra över manuellt.</div>
                    </div>
                  </label>
                  
                  {newBillAutoTransfer !== '' && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(245, 158, 11, 0.2)' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Vem har autogirot?</label>
                      <select 
                        value={newBillAutoTransfer} 
                        onChange={e => setNewBillAutoTransfer(e.target.value)}
                        style={{ marginBottom: '0.5rem', width: '100%' }}
                      >
                        <option value="all">Alla (Pengarna dras direkt från gemensamt konto)</option>
                        {state.accounts.filter(a => a.type === 'person').sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(acc => (
                          <option key={acc.id} value={acc.id}>
                            Bara {acc.name} (Dras från {acc.name}s egna konto)
                          </option>
                        ))}
                      </select>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {newBillAutoTransfer === 'all' && 'Ingen behöver föra över denna summa manuellt.'}
                        {newBillAutoTransfer !== 'all' && `Bara ${state.accounts.find(a => a.id === newBillAutoTransfer)?.name || '?'} slipper föra över sin andel manuellt.`}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
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
          <h3 className="card-title">Gemensamma Räkningar (Månadsvyn)</h3>
          <div className="bill-list" style={{ marginBottom: '2rem' }}>
            {state.bills.filter(b => !b.isArchived).sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(bill => {
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
                {(state.privateBills || []).filter(b => b.userId === user?.id && !b.isArchived).sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(bill => {
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
