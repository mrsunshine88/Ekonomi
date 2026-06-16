import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import BankImportModal from './BankImportModal';
import { parseBankData } from '../utils/bankParser';
import type { BankParseResult, ParsedBankRow } from '../utils/bankParser';
import * as xlsx from 'xlsx';

// Categories for Manual Entry
const MANUAL_CATEGORIES = [
  { id: 'boende', name: 'Boende', icon: '🏠', defaultVal: '' },
  { id: 'el', name: 'El', icon: '⚡', defaultVal: '' },
  { id: 'mobil', name: 'Mobil', icon: '📱', defaultVal: '' },
  { id: 'internet', name: 'Internet', icon: '🌐', defaultVal: '' },
  { id: 'bil', name: 'Bil/Transport', icon: '🚗', defaultVal: '' },
  { id: 'forsakring', name: 'Försäkringar', icon: '🛡️', defaultVal: '' },
  { id: 'streaming', name: 'Streaming', icon: '📺', defaultVal: '' }
];

const INCOME_CATEGORIES = [
  { id: 'lon', name: 'Lön', icon: '💰', defaultVal: '' },
  { id: 'barnbidrag', name: 'Barnbidrag', icon: '👶', defaultVal: '' },
  { id: 'underhall', name: 'Underhåll', icon: '❤️', defaultVal: '' },
  { id: 'bostadsbidrag', name: 'Bostadsbidrag', icon: '🏠', defaultVal: '' }
];

interface WizardState {
  householdName: string;
  members: { id: string; name: string; isChild: boolean }[];
  bills: { id: string; name: string; amount: number; account: string; interval: string }[];
  incomes: { id: string; name: string; amount: number; account: string }[];
}

export default function SetupWizard() {
  const { user, refreshHousehold } = useAuth();
  
  // Steps: 
  // 0: Check recovery
  // 1: Household & Members
  // 2: Tracks
  // 3: Bank Import OR Manual Entry
  // 4: Confirmation
  // 5: Committing Animation
  // 6: Wow Overlay (with MonthView behind)
  const [step, setStep] = useState(0);
  
  const [state, setState] = useState<WizardState>({
    householdName: '',
    members: [{ id: crypto.randomUUID(), name: '', isChild: false }],
    bills: [],
    incomes: []
  });


  const [loadingMsg, setLoadingMsg] = useState('');
  const [importError, setImportError] = useState('');
  
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  
  // Bank Import State
  const [parseResult, setParseResult] = useState<BankParseResult | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('setupWizardState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.householdName && !parsed.members[0].name) {
          setStep(1);
        }
      } catch (e) {
        setStep(1);
      }
    } else {
      setStep(1);
    }
  }, []);

  const saveState = (newState: Partial<WizardState>) => {
    const updated = { ...state, ...newState };
    setState(updated);
    sessionStorage.setItem('setupWizardState', JSON.stringify(updated));
  };

  const recoverState = () => {
    const saved = sessionStorage.getItem('setupWizardState');
    if (saved) {
      setState(JSON.parse(saved));
    }
    setStep(1);
  };

  const startFresh = () => {
    sessionStorage.removeItem('setupWizardState');
    setState({
      householdName: '',
      members: [{ id: crypto.randomUUID(), name: '', isChild: false }],
      bills: [],
      incomes: []
    });
    setStep(1);
  };

  const handleSkipToPaywall = async () => {
    if (!user) return;
    setLoadingMsg('Förbereder...');
    setStep(5);
    try {
      // Create empty household
      const { error } = await supabase.rpc('create_initial_household_setup', {
        p_household_name: 'Mitt hushåll',
        p_members: [{ name: 'Konto', is_child: false }],
        p_bills: [],
        p_incomes: []
      });
      if (error) throw error;
      
      sessionStorage.removeItem('setupWizardState');
      await refreshHousehold();
      // App.tsx routes to MonthView read-only automatically
    } catch (e: any) {
      console.error(e);
      alert('Kunde inte hoppa över: ' + e.message);
      setStep(2);
    }
  };

  const commitSetup = async () => {
    if (!user) return;
    
    // Safety check
    const hasValidMembers = state.members.filter(m => m.name.trim()).length > 0;
    if (!state.householdName.trim() || !hasValidMembers) {
      alert("Hushållsnamn och minst en medlem krävs.");
      setStep(1);
      return;
    }
    if (state.bills.length === 0 && state.incomes.length === 0) {
      alert("Du behöver lägga till minst en inkomst eller en fast kostnad.");
      return;
    }

    setLoadingMsg('Validerar...');
    setStep(5);
    
    try {
      setTimeout(() => setLoadingMsg('Sparar...'), 1000);
      
      const membersToCreate = state.members.filter(m => m.name.trim()).map(m => ({
        name: m.name.trim(),
        is_child: m.isChild
      }));
      
      const { error } = await supabase.rpc('create_initial_household_setup', {
        p_household_name: state.householdName.trim(),
        p_members: membersToCreate,
        p_bills: state.bills.map(b => ({ name: b.name, amount: b.amount, account: b.account, interval: b.interval })),
        p_incomes: state.incomes.map(i => ({ name: i.name, amount: i.amount, account: i.account }))
      });
      
      if (error) throw error;
      
      sessionStorage.removeItem('setupWizardState');
      
      // Vi sätter steget till 6 (Wow-overlay). När de klickar Klar kör vi refreshHousehold.
      setTimeout(() => setStep(6), 1000);
    } catch (e: any) {
      console.error(e);
      alert('Ett fel uppstod: ' + e.message);
      setStep(4);
    }
  };

  const finishWow = async () => {
    await refreshHousehold(); // Reloads state, sets setup_status = readonly_user, App routes to MonthView
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingMsg('Analyserar bankfil...');
    setImportError('');
    
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
            if (sheetJson[i] && sheetJson[i].some((cell: any) => typeof cell === 'string' && cell.toLowerCase().includes('kategori'))) {
              hasKategori = true;
              break;
            }
          }
          if (hasKategori) {
            json = sheetJson;
            break;
          }
        }
        if (json.length === 0) {
           const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
           json = xlsx.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        }

        // Provide fake household accounts and profiles for the parser
        const mockAccounts = state.members.filter(m => m.name.trim()).map(m => ({ id: m.id, name: m.name, type: 'person' }));
        const mockProfiles = mockAccounts.map(a => ({ id: a.id, display_name: a.name }));
        
        const result = parseBankData(json, [], mockAccounts as any, mockProfiles, [], []);
        setParseResult(result);
        setLoadingMsg('');
      } catch (err: any) {
        setImportError('Ett fel uppstod: ' + err.message);
        setLoadingMsg('');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBankConfirm = (selectedRows: ParsedBankRow[]) => {
    const newBills: WizardState['bills'] = [];
    const newIncomes: WizardState['incomes'] = [];
    
    // Simple resolution back to account names since BankImportModal gives us target IDs or uses the mock IDs
    selectedRows.forEach(row => {
      const targetAcc = state.members.find(m => m.id === row.selectedUserId);
      const accName = targetAcc ? targetAcc.name : state.members[0]?.name || 'Gemensamt';
      
      if (row.isIncoming) {
        newIncomes.push({ id: crypto.randomUUID(), name: row.rawDescription.trim(), amount: row.amount, account: accName });
      } else {
        newBills.push({ id: crypto.randomUUID(), name: row.rawDescription.trim(), amount: row.amount, account: accName, interval: 'all' });
      }
    });
    
    saveState({ bills: [...state.bills, ...newBills], incomes: [...state.incomes, ...newIncomes] });
    setParseResult(null);
    setStep(4);
  };

  const handleJoin = async () => {
    if (!inviteCode) return;
    setLoadingMsg('Går med i hushåll...');
    setJoinError('');
    try {
      if (!user) throw new Error("Inte inloggad.");
      const { data: hhData, error: hhErr } = await supabase.from('households').select('id').eq('id', inviteCode).single();
      if (hhErr || !hhData) throw new Error("Kunde inte hitta ett hushåll med den koden.");
      
      const { error } = await supabase.from('profiles').upsert([{ id: user.id, email: user.email, household_id: inviteCode, role: 'member', setup_status: 'readonly_user' }]);
      if (error) throw error;
      
      sessionStorage.removeItem('setupWizardState');
      await refreshHousehold();
    } catch (err: any) {
      console.error(err);
      setJoinError('❌ ' + err.message);
      setLoadingMsg('');
    }
  };

  // ---------------- Renderers ----------------

  if (step === 0) {
    return (
      <div className="wizard-container">
        <div className="wizard-card">
          <h2>👋 Välkommen tillbaka</h2>
          <p>Du påbörjade installationen tidigare.</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button className="primary-btn" onClick={recoverState} style={{ flex: 1 }}>Fortsätt</button>
            <button className="secondary-btn" onClick={startFresh} style={{ flex: 1 }}>Börja om</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="wizard-container">
        <div className="wizard-card">
          <h2>Hushåll & Medlemmar</h2>
          <p>Vad heter ert hushåll?</p>
          <input 
            value={state.householdName} 
            onChange={e => saveState({ householdName: e.target.value })} 
            placeholder="T.ex. ICA-kortet eller Familjen..."
            className="wizard-input"
          />
          
          <p style={{ marginTop: '2rem' }}>Vilka är med?</p>
          {state.members.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input 
                value={m.name} 
                onChange={e => {
                  const newM = [...state.members];
                  newM[i].name = e.target.value;
                  saveState({ members: newM });
                }}
                placeholder={`Person ${i + 1}`}
                className="wizard-input"
              />
              {state.members.length > 1 && (
                <button onClick={() => saveState({ members: state.members.filter((_, idx) => idx !== i) })} className="danger-btn">✕</button>
              )}
            </div>
          ))}
          <button onClick={() => saveState({ members: [...state.members, { id: crypto.randomUUID(), name: '', isChild: false }] })} className="secondary-btn" style={{ width: '100%', marginBottom: '2rem' }}>
            + Lägg till person
          </button>
          
          <button 
            disabled={!state.householdName.trim() || !state.members[0].name.trim() || loadingMsg !== ''}
            onClick={() => setStep(2)} 
            className="primary-btn" 
            style={{ width: '100%' }}
          >
            Nästa
          </button>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem', marginTop: '2rem' }}>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1rem' }}>Har du blivit inbjuden?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Klistra in inbjudningskoden från hushållets grundare för att ansluta (du behöver då inte betala).
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Klistra in inbjudningskod..." 
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
              />
              <button 
                onClick={handleJoin}
                disabled={loadingMsg !== ''}
                style={{ background: 'var(--accent-color)', color: '#fff', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {loadingMsg ? '...' : 'Gå med'}
              </button>
            </div>
            {joinError && <p style={{ color: 'var(--danger-color)', marginTop: '1rem', fontSize: '0.9rem' }}>{joinError}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="wizard-container">
        <div className="wizard-card" style={{ maxWidth: '600px' }}>
          <h2>Hur vill du komma igång?</h2>
          <p style={{ marginBottom: '2rem' }}>Välj det sätt som passar dig bäst för att bygga din första budget.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="track-card" onClick={() => setStep(3)}>
              <h3>🟣 Importera bankfil</h3>
              <p>Rekommenderas – tar ca 1 minut. Vi analyserar din historik och hittar dina fasta kostnader automatiskt.</p>
            </div>
            
            <div className="track-card" onClick={() => setStep(3.5)}>
              <h3>⚪ Lägg in manuellt</h3>
              <p>Skapa din första budget på några minuter med våra snabbval. Inga komplicerade formulär.</p>
            </div>
          </div>
          
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <button onClick={handleSkipToPaywall} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }}>
              Hoppa över importen →
            </button>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Du kan börja med ett tomt hushåll och lägga in allt själv senare.</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    if (parseResult) {
      const mockAccounts = state.members.filter(m => m.name.trim()).map(m => ({ id: m.id, name: m.name }));
      const mockProfiles = mockAccounts.map(a => ({ id: a.id, display_name: a.name }));
      return (
        <BankImportModal 
          parseResult={parseResult} 
          accounts={mockAccounts} 
          profiles={mockProfiles} 
          onConfirm={handleBankConfirm} 
          onCancel={() => setParseResult(null)} 
        />
      );
    }

    return (
      <div className="wizard-container">
        <div className="wizard-card">
          <h2>Importera bankfil</h2>
          <p>Ladda ner en export från din bank (Excel/CSV) och välj den här.</p>
          
          <div style={{ border: '2px dashed var(--border-color)', padding: '2rem', borderRadius: '12px', marginTop: '2rem', marginBottom: '2rem' }}>
            {loadingMsg ? (
              <p>{loadingMsg}</p>
            ) : (
              <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} style={{ width: '100%' }} />
            )}
            {importError && <p style={{ color: 'var(--danger-color)', marginTop: '1rem' }}>{importError}</p>}
          </div>
          
          <button onClick={() => setStep(2)} className="secondary-btn" style={{ width: '100%' }}>Tillbaka</button>
        </div>
      </div>
    );
  }

  if (step === 3.5) {
    // Manual Entry UI
    return (
      <div className="wizard-container">
        <div className="wizard-card" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
          <h2>Skapa din första budget</h2>
          <p style={{ marginBottom: '1rem' }}>Fyll i beloppen för dina vanligaste inkomster och utgifter.</p>
          
          <h3 style={{ marginTop: '1rem', color: 'var(--success-color)' }}>Inkomster</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            {INCOME_CATEGORIES.map(cat => {
              const existing = state.incomes.find(i => i.name === cat.name);
              return (
                <div key={cat.id} className="manual-card">
                  <div className="manual-card-title">{cat.icon} {cat.name}</div>
                  <input 
                    type="number" 
                    placeholder="0 kr" 
                    value={existing?.amount || ''} 
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      if (val > 0) {
                        const newInc = existing 
                          ? state.incomes.map(i => i.name === cat.name ? { ...i, amount: val } : i)
                          : [...state.incomes, { id: crypto.randomUUID(), name: cat.name, amount: val, account: state.members[0].name }];
                        saveState({ incomes: newInc });
                      } else {
                        saveState({ incomes: state.incomes.filter(i => i.name !== cat.name) });
                      }
                    }}
                    className="wizard-input"
                  />
                </div>
              );
            })}
          </div>

          <h3 style={{ color: 'var(--danger-color)' }}>Fasta kostnader</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            {MANUAL_CATEGORIES.map(cat => {
              const existing = state.bills.find(b => b.name === cat.name);
              return (
                <div key={cat.id} className="manual-card">
                  <div className="manual-card-title">{cat.icon} {cat.name}</div>
                  <input 
                    type="number" 
                    placeholder="0 kr" 
                    value={existing?.amount || ''} 
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      if (val > 0) {
                        const newBills = existing 
                          ? state.bills.map(b => b.name === cat.name ? { ...b, amount: val } : b)
                          : [...state.bills, { id: crypto.randomUUID(), name: cat.name, amount: val, account: state.members[0].name, interval: 'all' }];
                        saveState({ bills: newBills });
                      } else {
                        saveState({ bills: state.bills.filter(b => b.name !== cat.name) });
                      }
                    }}
                    className="wizard-input"
                  />
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setStep(2)} className="secondary-btn" style={{ flex: 1 }}>Tillbaka</button>
            <button onClick={() => setStep(4)} className="primary-btn" style={{ flex: 2 }}>Gå vidare</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 4) {
    const totalIncome = state.incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalBills = state.bills.reduce((sum, b) => sum + b.amount, 0);

    return (
      <div className="wizard-container">
        <div className="wizard-card">
          <h2>Bekräfta Startbudget</h2>
          <p>Vi hittade följande data för {state.householdName}:</p>
          
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', margin: '2rem 0', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Vuxna i hushållet:</span>
              <strong>{state.members.filter(m => m.name.trim()).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--success-color)' }}>
              <span>{state.incomes.length} inkomster:</span>
              <strong>{totalIncome.toLocaleString('sv-SE')} kr</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger-color)' }}>
              <span>{state.bills.length} återkommande kostnader:</span>
              <strong>{totalBills.toLocaleString('sv-SE')} kr</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setStep(2)} className="secondary-btn" style={{ flex: 1 }}>Ändra</button>
            <button onClick={commitSetup} className="primary-btn" style={{ flex: 2 }}>Skapa min budget</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="wizard-container">
        <div className="wizard-card">
          <div className="spinner" style={{ margin: '0 auto 2rem auto', borderTopColor: 'var(--accent-color)' }}></div>
          <h2>{loadingMsg}</h2>
          <p>Bygger upp din Ekonomi...</p>
        </div>
      </div>
    );
  }

  if (step === 6) {
    const totalIncome = state.incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalBills = state.bills.reduce((sum, b) => sum + b.amount, 0);
    const netto = totalIncome - totalBills;

    return (
      <>
        {/* We render MonthView in the background in ReadOnly mode (it doesn't have data yet locally, but it looks like app) */}
        <div style={{ opacity: 0.3, pointerEvents: 'none', height: '100vh', overflow: 'hidden' }}>
          {/* We fake a MonthView here since we don't have real app data fetched yet, or we just render an empty view */}
        </div>
        
        <div className="wizard-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000 }}>
          <div className="wizard-card wow-overlay">
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎉 SmartEkonomi är redo</h1>
            
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Du har cirka</p>
            <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'var(--success-color)', marginBottom: '0.5rem' }}>
              {netto.toLocaleString('sv-SE')} kr
            </div>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              kvar varje månad efter dina fasta kostnader.
            </p>
            
            <p style={{ marginBottom: '2rem', lineHeight: '1.5' }}>
              <em>Det är pengar som nu kan planeras, sparas eller användas till annat.</em>
            </p>

            <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
              <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Baserat på:</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>✓ {state.bills.length} återkommande betalningar</li>
                <li>✓ {state.incomes.length} inkomster</li>
                <li>✓ {state.members.filter(m=>m.name.trim()).length} hushållsmedlemmar</li>
              </ul>
            </div>
            
            <button onClick={finishWow} className="primary-btn" style={{ width: '100%', fontSize: '1.2rem', padding: '1rem' }}>
              Öppna min budget
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
}
