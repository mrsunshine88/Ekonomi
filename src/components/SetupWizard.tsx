import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import BankImportModal from './BankImportModal';
import { normalizeLearningString } from '../utils/normalization';
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
  bills: { id: string; name: string; amount: number; account: string; interval: string; isCustom?: boolean }[];
  incomes: { id: string; name: string; amount: number; account: string; isCustom?: boolean; type?: 'fixed' | 'variable'; pay_date?: string }[];
}

const AnimatedNumber = ({ value }: { value: number }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1500;
    const startTime = performance.now();
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(Math.floor(value * ease));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <>{display.toLocaleString('sv-SE')}</>;
};

export default function SetupWizard() {
  const { user, refreshHousehold } = useAuth();
  
  const [step, setStep] = useState(0);
  const [paywallActive, setPaywallActive] = useState(true);
  
  useEffect(() => {
    supabase.from('global_settings').select('value').eq('key', 'paywall_active').maybeSingle()
      .then(({ data }: { data: { value: string } | null }) => setPaywallActive(data?.value === 'true'));
  }, []);
  
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
  
  const [parseResult, setParseResult] = useState<BankParseResult | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, BankParseResult>>({});

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
    setStep(10);
    try {
      const { data, error } = await supabase.rpc('create_initial_household_setup', {
        p_household_name: 'Mitt hushåll',
        p_members: [{ name: 'Konto', is_child: false }],
        p_bills: [],
        p_incomes: []
      });
      if (error) throw error;
      sessionStorage.removeItem('setupWizardState');
      
      if (paywallActive) {
        setLoadingMsg('Startar betalning...');
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ householdId: data.household_id, customerEmail: session?.user?.email })
        });
        const checkoutData = await res.json();
        if (checkoutData.error) throw new Error(checkoutData.error);
        window.location.href = checkoutData.url;
      } else {
        await refreshHousehold();
      }
    } catch (e: any) {
      console.error(e);
      alert('Kunde inte hoppa över: ' + e.message);
      setStep(2);
    }
  };

  const commitSetup = async (proceedToPaywall: boolean) => {
    if (!user) return;
    const hasValidMembers = state.members.filter(m => m.name.trim()).length > 0;
    if (!state.householdName.trim() || !hasValidMembers) {
      alert("Hushållsnamn och minst en medlem krävs.");
      setStep(1);
      return;
    }

    setLoadingMsg('Sparar din budget...');
    const originalStep = step;
    setStep(10);
    
    try {
      const membersToCreate = state.members.filter(m => m.name.trim()).map(m => ({
        name: m.name.trim(),
        is_child: m.isChild
      }));
      
      const { data, error } = await supabase.rpc('create_initial_household_setup', {
        p_household_name: state.householdName.trim(),
        p_members: membersToCreate,
        p_bills: state.bills.filter(b => b.amount > 0 && b.name.trim()).map(b => ({ 
          name: b.name.trim(), 
          amount: b.amount, 
          account: b.account, 
          interval: b.interval,
          normalized_name: normalizeLearningString(b.name.trim()),
          transaction_direction: 'OUT',
          source: 'ONBOARDING'
        })),
        p_incomes: state.incomes.filter(i => i.amount > 0 && i.name.trim()).map(i => ({ 
          name: i.name.trim(), 
          amount: i.amount, 
          account: i.account,
          type: i.type || 'fixed',
          pay_date: i.pay_date || null,
          normalized_name: normalizeLearningString(i.name.trim()),
          transaction_direction: 'IN',
          source: 'ONBOARDING'
        }))
      });
      
      if (error) throw error;
      sessionStorage.removeItem('setupWizardState');
      
      if (proceedToPaywall) {
        setLoadingMsg('Startar betalning...');
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ householdId: data.household_id, customerEmail: session?.user?.email })
        });
        const checkoutData = await res.json();
        if (checkoutData.error) throw new Error(checkoutData.error);
        window.location.href = checkoutData.url;
      } else {
        await refreshHousehold();
      }
    } catch (e: any) {
      console.error(e);
      alert('Ett fel uppstod: ' + e.message);
      setStep(originalStep);
    }
  };

  const handleFileUploadForMember = (e: React.ChangeEvent<HTMLInputElement>, memberId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingMsg(`Analyserar bankfil för ${state.members.find(m => m.id === memberId)?.name || 'medlem'}...`);
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
        
        // Lär av redan inlagda räkningar/inkomster (skapa temporära regler för denna session)
        const tempRules: any[] = [
          ...state.bills.map(b => ({
            id: b.id,
            search_string: b.name.toUpperCase().replace(/[^A-Z0-9ÅÄÖ ]/g, ' ').replace(/\s+/g, ' ').trim(), // Förenklad normalize
            is_bill: true,
            rule_target_type: 'ACCOUNT',
            target_id: state.members.find(m => m.name === b.account)?.id || mockAccounts[0]?.id,
            usage_count: 5
          })),
          ...state.incomes.map(i => ({
            id: i.id,
            search_string: i.name.toUpperCase().replace(/[^A-Z0-9ÅÄÖ ]/g, ' ').replace(/\s+/g, ' ').trim(),
            is_bill: false,
            rule_target_type: 'USER',
            target_id: state.members.find(m => m.name === i.account)?.id || mockProfiles[0]?.id,
            usage_count: 5
          }))
        ];

        const result = parseBankData(json, tempRules, mockAccounts as any, mockProfiles, [], []);
        
        // Auto-assign owner
        const setOwner = (arr: any[]) => {
          arr.forEach((row: any) => {
            row.selectedUserId = memberId;
          });
        };
        setOwner(result.suggestedIncomes);
        setOwner(result.suggestedBills);
        setOwner(result.otherTransactions);

        setUploadedFiles(prev => ({ ...prev, [memberId]: result }));
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
        const descUpper = row.rawDescription.toUpperCase();
        const isSalary = descUpper.includes('LÖN') || descUpper.includes('SALARY') || descUpper.includes('UTBETALNING') || descUpper.includes('FÖRSÄKRINGSKASSAN');
        newIncomes.push({ 
          id: crypto.randomUUID(), 
          name: row.rawDescription.trim(), 
          amount: row.amount, 
          account: accName,
          type: isSalary ? 'variable' : 'fixed',
          pay_date: isSalary ? row.date : undefined
        });
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
            style={{ 
              width: '100%', 
              background: (!state.householdName.trim() || !state.members[0].name.trim() || loadingMsg !== '') ? 'rgba(99, 102, 241, 0.4)' : 'var(--accent-color)', 
              color: '#fff', 
              padding: '1rem', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: (!state.householdName.trim() || !state.members[0].name.trim() || loadingMsg !== '') ? 'not-allowed' : 'pointer', 
              fontWeight: 'bold',
              fontSize: '1.1rem',
              transition: 'all 0.2s'
            }}
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

    const validMembers = state.members.filter(m => m.name.trim() && !m.isChild);
    const hasAnyUpload = Object.keys(uploadedFiles).length > 0;
    const isSingle = validMembers.length === 1;
    const uploadCount = Object.keys(uploadedFiles).length;
    const totalCount = validMembers.length;

    const handleCombineAndReview = () => {
      const combinedResult = {
        suggestedIncomes: [] as any[],
        suggestedBills: [] as any[],
        otherTransactions: [] as any[],
        summary: {
          suggestedIncomesCount: 0,
          suggestedCount: 0,
          recognizedSuggestedCount: 0,
          otherCount: 0,
          unknownCount: 0,
        }
      };

      Object.values(uploadedFiles).forEach(res => {
         combinedResult.suggestedIncomes.push(...res.suggestedIncomes);
         combinedResult.suggestedBills.push(...res.suggestedBills);
         combinedResult.otherTransactions.push(...res.otherTransactions);
         combinedResult.summary.suggestedIncomesCount += res.summary.suggestedIncomesCount;
         combinedResult.summary.suggestedCount += res.summary.suggestedCount;
         combinedResult.summary.recognizedSuggestedCount += res.summary.recognizedSuggestedCount;
         combinedResult.summary.otherCount += res.summary.otherCount;
         combinedResult.summary.unknownCount += res.summary.unknownCount;
      });
      setParseResult(combinedResult);
    };

    return (
      <div className="wizard-container">
        <div className="wizard-card">
          <h2>Importera bankfiler</h2>
          <p>{isSingle ? 'Ladda upp en kontoexport från banken (Excel/CSV).' : 'Ladda upp en kontoexport från banken (Excel/CSV) för respektive vuxen.'}</p>
          
          <div style={{ marginTop: '2rem', marginBottom: '2rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--text-secondary)', margin: 0 }}>{isSingle ? 'Bankfil' : 'Bankfiler'}</h3>
              {!isSingle && (
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: uploadCount > 0 ? 'var(--success-color)' : 'var(--text-muted)' }}>
                  {uploadCount > 0 && '✓ '} {uploadCount} av {totalCount} bankfiler uppladdade
                </span>
              )}
            </div>

            {validMembers.map(m => {
              const res = uploadedFiles[m.id];
              return (
                <div key={m.id} style={{ 
                  background: 'rgba(0,0,0,0.2)', 
                  border: '1px solid var(--border-color)', 
                  padding: '1.5rem', 
                  borderRadius: '12px', 
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '1.1rem' }}>
                      {res ? (
                        <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>
                          ✓ {isSingle ? 'Bankfil uppladdad' : `${m.name} - Bankfil uppladdad`} ({res.suggestedIncomes.length + res.suggestedBills.length + res.otherTransactions.length} transaktioner)
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>
                          ○ {isSingle ? 'Ingen bankfil uppladdad' : `${m.name} - Bankfil saknas`}
                        </span>
                      )}
                    </div>
                  </div>
                  {!res && (
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="file" 
                        accept=".csv, .xlsx, .xls" 
                        onChange={(e) => handleFileUploadForMember(e, m.id)} 
                        style={{ 
                          position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' 
                        }} 
                      />
                      <button className="secondary-btn" style={{ width: '100%', pointerEvents: 'none' }}>
                        Ladda upp bankfil{isSingle ? '' : ` för ${m.name}`}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            
            {!isSingle && (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '1.5rem', fontStyle: 'italic' }}>
                Ladda gärna upp allas bankfiler för bästa resultat, men du kan fortsätta med en fil och lägga till fler senare.
              </p>
            )}
          </div>

          {loadingMsg && <p style={{ color: 'var(--accent-color)', marginBottom: '1rem' }}>{loadingMsg}</p>}
          {importError && <p style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{importError}</p>}
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setStep(2)} className="secondary-btn" style={{ flex: 1 }}>Tillbaka</button>
            <button 
              onClick={handleCombineAndReview} 
              className="primary-btn" 
              style={{ flex: 2, opacity: hasAnyUpload ? 1 : 0.5, cursor: hasAnyUpload ? 'pointer' : 'not-allowed' }}
              disabled={!hasAnyUpload}
            >
              Fortsätt ➔
            </button>
          </div>
          
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <button onClick={handleSkipToPaywall} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }}>
              Jag vill lägga in allt senare ➔
            </button>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Du kan börja med ett tomt hushåll och lägga in allt själv senare.</p>
          </div>
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
            
            {state.incomes.filter(i => i.isCustom).map(inc => (
              <div key={inc.id} className="manual-card" style={{ border: '1px dashed var(--accent-color)' }}>
                <input 
                  type="text" 
                  placeholder="Inkomstens namn..." 
                  value={inc.name}
                  onChange={e => {
                    const newInc = state.incomes.map(i => i.id === inc.id ? { ...i, name: e.target.value } : i);
                    saveState({ incomes: newInc });
                  }}
                  className="wizard-input"
                  style={{ marginBottom: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem' }}
                />
                <input 
                  type="number" 
                  placeholder="0 kr" 
                  value={inc.amount || ''} 
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0;
                    const newInc = state.incomes.map(i => i.id === inc.id ? { ...i, amount: val } : i);
                    saveState({ incomes: newInc });
                  }}
                  className="wizard-input"
                />
              </div>
            ))}
            
            <button 
              onClick={() => saveState({ incomes: [...state.incomes, { id: crypto.randomUUID(), name: '', amount: 0, account: state.members[0].name, isCustom: true }] })}
              style={{ background: 'transparent', border: '2px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px', fontSize: '1.1rem' }}
            >
              + Lägg till annan
            </button>
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

            {state.bills.filter(b => b.isCustom).map(bill => (
              <div key={bill.id} className="manual-card" style={{ border: '1px dashed var(--accent-color)' }}>
                <input 
                  type="text" 
                  placeholder="Räkningens namn..." 
                  value={bill.name}
                  onChange={e => {
                    const newBills = state.bills.map(b => b.id === bill.id ? { ...b, name: e.target.value } : b);
                    saveState({ bills: newBills });
                  }}
                  className="wizard-input"
                  style={{ marginBottom: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem' }}
                />
                <input 
                  type="number" 
                  placeholder="0 kr" 
                  value={bill.amount || ''} 
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0;
                    const newBills = state.bills.map(b => b.id === bill.id ? { ...b, amount: val } : b);
                    saveState({ bills: newBills });
                  }}
                  className="wizard-input"
                />
              </div>
            ))}

            <button 
              onClick={() => saveState({ bills: [...state.bills, { id: crypto.randomUUID(), name: '', amount: 0, account: state.members[0].name, interval: 'all', isCustom: true }] })}
              style={{ background: 'transparent', border: '2px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px', fontSize: '1.1rem' }}
            >
              + Lägg till annan
            </button>
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
    const validIncomes = state.incomes.filter(i => i.amount > 0 && i.name.trim());
    const validBills = state.bills.filter(b => b.amount > 0 && b.name.trim());
    const totalIncome = validIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalBills = validBills.reduce((sum, b) => sum + b.amount, 0);
    const netto = totalIncome - totalBills;

    return (
      <div className="wizard-container">
        <div className="wizard-card" style={{ maxWidth: '650px' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Din Månadsöversikt 📊</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Här är en sammanställning av hushållets ekonomi.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
            {/* Inkomster */}
            <div style={{ 
              background: 'rgba(16, 185, 129, 0.1)', 
              border: '1px solid rgba(16, 185, 129, 0.2)', 
              borderRadius: '16px', 
              padding: '1.5rem', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
            }}>
              <div>
                <h3 style={{ color: 'var(--success-color)', fontSize: '1.1rem', margin: 0, textAlign: 'left' }}>Mina Inkomster</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>(Lön, bidrag m.m.)</div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success-color)' }}>
                <AnimatedNumber value={totalIncome} /> kr 💰
              </div>
            </div>

            {/* Utgifter */}
            <div style={{ 
              background: 'rgba(244, 63, 94, 0.1)', 
              border: '1px solid rgba(244, 63, 94, 0.2)', 
              borderRadius: '16px', 
              padding: '1.5rem', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
            }}>
              <div>
                <h3 style={{ color: 'var(--danger-color)', fontSize: '1.1rem', margin: 0, textAlign: 'left' }}>Mina Utgifter</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>(Räkningar, boende m.m.)</div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>
                -<AnimatedNumber value={totalBills} /> kr 💸
              </div>
            </div>

            {/* Sparutrymme */}
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(217, 119, 6, 0.15) 100%)', 
              border: '1px solid rgba(234, 179, 8, 0.3)', 
              borderRadius: '16px', 
              padding: '2rem 1.5rem', 
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(234, 179, 8, 0.15)'
            }}>
              <h3 style={{ color: '#eab308', fontSize: '1.1rem', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                ⭐ Det här sparar du denna månad:
              </h3>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#fde047', textShadow: '0 2px 10px rgba(234, 179, 8, 0.4)' }}>
                <AnimatedNumber value={Math.max(0, netto)} /> kr
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setStep(2)} className="secondary-btn" style={{ flex: 1, padding: '1.2rem', borderRadius: '12px' }}>Ändra</button>
            <button 
              onClick={() => {
                if (paywallActive) {
                  setStep(5);
                } else {
                  commitSetup(false);
                }
              }} 
              style={{ 
                flex: 3,
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', 
                color: 'white', 
                padding: '1.2rem', 
                border: 'none', 
                borderRadius: '12px', 
                cursor: 'pointer', 
                fontWeight: 'bold', 
                fontSize: '1.2rem',
                boxShadow: '0 4px 15px rgba(217, 119, 6, 0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              GÅ VIDARE FÖR ATT SPARA DIN BUDGET ➔
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="wizard-container">
        <div className="wizard-card" style={{ maxWidth: '500px', padding: '3rem 2rem' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: '#fff' }}>
            Spara din budget och få full koll! 📑🚀
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            För mindre än 2 kronor om dagen hjälper vi dig och ditt hushåll att hålla koll på pengarna, varje månad.
          </p>
          
          <div style={{ 
            background: 'rgba(16, 185, 129, 0.1)', 
            border: '1px solid rgba(16, 185, 129, 0.3)', 
            borderRadius: '12px', 
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <h3 style={{ color: 'var(--success-color)', fontSize: '1.2rem', margin: '0 0 1rem 0' }}>
              💳 Pris: Endast 59 kr i månaden per hushåll.
            </h3>
            <div style={{ color: '#fff', textAlign: 'left' }}>
              <p style={{ marginBottom: '0.75rem', fontWeight: 'bold' }}>Detta ingår:</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: '1.8' }}>
                <li>✓ Spara och ändra din budget precis när du vill.</li>
                <li>✓ Smart översikt över inkomster och utgifter.</li>
                <li>✓ Full koll på vad ni har över varje månad.</li>
                <li>✓ Ingen bindningstid – avsluta när du vill.</li>
              </ul>
            </div>
          </div>

          <button 
            onClick={() => commitSetup(true)} 
            disabled={loadingMsg !== ''}
            style={{ 
              width: '100%',
              background: 'var(--success-color)', 
              color: 'white', 
              padding: '1.2rem', 
              border: 'none', 
              borderRadius: '12px', 
              cursor: 'pointer', 
              fontWeight: 'bold', 
              fontSize: '1.3rem',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
            }}
          >
            {loadingMsg !== '' ? loadingMsg : 'BETALA 59 KR / MÅNAD'}
          </button>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
            När betalningen är klar skickas du direkt in på sidan till din sparade budget!
          </p>
        </div>
      </div>
    );
  }

  if (step === 10) {
    return (
      <div className="wizard-container">
        <div className="wizard-card">
          <div className="spinner" style={{ margin: '0 auto 2rem auto', borderTopColor: 'var(--accent-color)' }}></div>
          <h2>{loadingMsg}</h2>
          <p>Ett ögonblick...</p>
        </div>
      </div>
    );
  }

  return null;
}
