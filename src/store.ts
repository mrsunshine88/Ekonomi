import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import type { AppState, BillDefinition, MonthData, CalculationResult, Account, SwishTransfer, PrivateBill } from './types';

const STORAGE_KEY = 'ekonomiapp_state_v1';

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'shared_1', name: 'Gemensamt konto', type: 'shared', transferMethod: 'transfer' },
  { id: 'person_1', name: 'Person 1', type: 'person', transferMethod: 'swish' },
  { id: 'person_2', name: 'Person 2', type: 'person', transferMethod: 'swish' }
];

const DEFAULT_BILLS: BillDefinition[] = [];

const SEED_MONTHS: Record<string, MonthData> = {};

const DEFAULT_STATE: AppState = {
  accounts: DEFAULT_ACCOUNTS,
  bills: DEFAULT_BILLS,
  months: SEED_MONTHS,
};

export function useStore(householdId: string | null) {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Migration logic for older bills
        let migratedBills = parsed.bills || DEFAULT_STATE.bills;
        migratedBills = migratedBills.map((b: any) => {
          let n = { ...b };
          if (n.category) {
            n.accountId = n.category === 'Huskonto' ? 'huskonto' : n.category === 'Andreas' ? 'andreas' : 'helena';
            delete n.category;
          }
          if (n.splitType === '50/50') n.splitType = 'equal';
          if (n.splitType === 'Andreas100') n.splitType = 'andreas';
          if (n.splitType === 'Helena100') n.splitType = 'helena';
          if (!n.interval || n._migratedIntervals !== true) {
            if (n.id === 'affarsverken' || n.id === 'karlskrona-kommun') {
              n.interval = 'odd';
            } else if (!n.interval) {
              n.interval = 'all';
            }
            n._migratedIntervals = true;
          }
          if (n.interval === 'custom' && !n.customMonths) {
            n.customMonths = [];
          }
          if (n.warnIfZero === undefined || n._migratedWarnings !== true) {
            if (n.id === 'affarsverken' || n.id === 'karlskrona-kommun') {
              n.warnIfZero = true;
            } else if (n.warnIfZero === undefined) {
              n.warnIfZero = false;
            }
            n._migratedWarnings = true;
          }
          return n;
        });

        const mergedMonths = { ...(parsed.months || {}) };
        Object.keys(SEED_MONTHS).forEach(key => {
          const existing = mergedMonths[key] || {};
          const hasNoBills = !existing.billAmounts || Object.keys(existing.billAmounts).length === 0;
          if (hasNoBills) {
            mergedMonths[key] = { ...SEED_MONTHS[key], ...existing, billAmounts: SEED_MONTHS[key].billAmounts };
          }
        });

        Object.values(mergedMonths).forEach((m: any) => {
          if (!m.handledPayments) m.handledPayments = {};
          if (m.andreasPaidHuskonto) { m.handledPayments['transfer_andreas_huskonto'] = true; delete m.andreasPaidHuskonto; }
          if (m.helenaPaidHuskonto) { m.handledPayments['transfer_helena_huskonto'] = true; delete m.helenaPaidHuskonto; }
          if (m.swishPaid) { m.handledPayments['swish_andreas_helena'] = true; delete m.swishPaid; }
        });
        
        let migratedAccounts = parsed.accounts || DEFAULT_ACCOUNTS;
        migratedAccounts = migratedAccounts.map((a: any) => {
          if (!a.transferMethod) {
            a.transferMethod = a.type === 'shared' ? 'transfer' : 'swish';
          }
          return a;
        });
        
        return {
          accounts: migratedAccounts,
          bills: migratedBills,
          months: mergedMonths
        };
      }
    } catch (e) {
      console.error('Failed to parse state from localStorage', e);
    }
    return DEFAULT_STATE;
  });

  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!householdId) {
      setIsCloudLoaded(false);
      return;
    }

    let mounted = true;

    const loadCloud = async () => {
      const { data } = await supabase.from('households').select('state_json').eq('id', householdId).single();
      if (!mounted) return;
      
      if (data && data.state_json && Object.keys(data.state_json).length > 0) {
        setState(data.state_json as AppState);
      } else {
        await supabase.from('households').update({ state_json: stateRef.current }).eq('id', householdId);
      }
      setIsCloudLoaded(true);
    };

    loadCloud();

    const channel = supabase.channel(`household_${householdId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, (payload) => {
        if (mounted && payload.new.state_json) {
           setState(payload.new.state_json as AppState);
        }
      }).subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [householdId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    
    if (!householdId || !isCloudLoaded) return;
    
    const timeout = setTimeout(() => {
      supabase.from('households').update({ state_json: state }).eq('id', householdId);
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [state, householdId, isCloudLoaded]);

  const updateBillAmount = (monthId: string, billId: string, amount: number) => {
    setState(prev => {
      const monthData = prev.months[monthId] || { monthId, billAmounts: {}, handledPayments: {} };
      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: {
            ...monthData,
            billAmounts: {
              ...monthData.billAmounts,
              [billId]: amount
            }
          }
        }
      };
    });
  };

  const addBill = (bill: BillDefinition) => {
    setState(prev => ({ ...prev, bills: [...prev.bills, bill] }));
  };

  const removeBill = (billId: string) => {
    setState(prev => ({ ...prev, bills: prev.bills.filter(b => b.id !== billId) }));
  };

  const updateBill = (bill: BillDefinition) => {
    setState(prev => ({ ...prev, bills: prev.bills.map(b => b.id === bill.id ? bill : b) }));
  };

  const addAccount = (account: Account) => {
    setState(prev => ({ ...prev, accounts: [...prev.accounts, account] }));
  };

  const removeAccount = (accountId: string) => {
    setState(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== accountId) }));
  };

  const updateAccount = (account: Account) => {
    setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === account.id ? account : a) }));
  };

  const copyFromPreviousMonth = (monthId: string) => {
    setState(prev => {
      const allMonths = Object.keys(prev.months).sort();
      const currentIndex = allMonths.indexOf(monthId);
      if (currentIndex <= 0) return prev;
      
      const prevMonthId = allMonths[currentIndex - 1];
      const prevMonth = prev.months[prevMonthId];
      if (!prevMonth) return prev;

      const currentMonthData = prev.months[monthId] || { monthId, billAmounts: {}, handledPayments: {} };
      const newAmounts = { ...currentMonthData.billAmounts };

      // Calculate locks
      const handled = currentMonthData.handledPayments || {};
      const lockedAccounts = new Set<string>();
      Object.keys(handled).forEach(paymentId => {
        if (handled[paymentId]) {
          if (paymentId.startsWith('transfer_')) {
            const parts = paymentId.split('_');
            if (parts.length >= 3) {
              const personId = parts[1];
              const sharedId = parts[2];
              lockedAccounts.add(personId);
              lockedAccounts.add(sharedId);
            }
          } else if (paymentId.startsWith('swish_')) {
            const [, fromId, toId] = paymentId.split('_');
            lockedAccounts.add(fromId);
            lockedAccounts.add(toId);
          }
        }
      });

      prev.bills.forEach(bill => {
         if (!lockedAccounts.has(bill.accountId)) {
           newAmounts[bill.id] = prevMonth.billAmounts[bill.id] !== undefined ? prevMonth.billAmounts[bill.id] : bill.defaultAmount;
         }
      });

      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: {
            ...currentMonthData,
            billAmounts: newAmounts
          }
        }
      };
    });
  };

  const togglePaymentStatus = (monthId: string, paymentId: string) => {
    setState(prev => {
      const monthData = prev.months[monthId] || { monthId, billAmounts: {}, handledPayments: {} };
      const currentHandled = monthData.handledPayments || {};
      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: {
            ...monthData,
            handledPayments: {
              ...currentHandled,
              [paymentId]: !currentHandled[paymentId]
            }
          }
        }
      };
    });
  };

  const confirmAnomaly = (monthId: string, billId: string) => {
    setState(prev => {
      const monthData = prev.months[monthId] || { monthId, billAmounts: {}, handledPayments: {} };
      const currentConfirmed = monthData.confirmedAnomalies || {};
      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: {
            ...monthData,
            confirmedAnomalies: {
              ...currentConfirmed,
              [billId]: true
            }
          }
        }
      };
    });
  };

  const unlockAccount = (monthId: string, accountId: string) => {
    setState(prev => {
      const monthData = prev.months[monthId];
      if (!monthData || !monthData.handledPayments) return prev;
      
      const newHandled = { ...monthData.handledPayments };
      
      Object.keys(newHandled).forEach(paymentId => {
        if (newHandled[paymentId]) {
          if (paymentId.startsWith('transfer_')) {
            const parts = paymentId.split('_');
            if (parts.length >= 3) {
              const personId = parts[1];
              const sharedId = parts[2];
              if (accountId === sharedId || accountId === personId) {
                newHandled[paymentId] = false;
              }
            }
          } else if (paymentId.startsWith('swish_')) {
            const [, fromId, toId] = paymentId.split('_');
            if (accountId === fromId || accountId === toId) {
              newHandled[paymentId] = false;
            }
          }
        }
      });

      return {
        ...prev,
        months: {
          ...prev.months,
          [monthId]: {
            ...monthData,
            handledPayments: newHandled
          }
        }
      };
    });
  };

  const updateSettings = (newSettings: Partial<AppState['settings']>) => {
    setState(prev => {
      const updated = { ...prev, settings: { ...prev.settings, ...newSettings } };
      return updated;
    });
  };

  const updatePrivateBillAmount = (monthId: string, billId: string, amount: number) => {
    setState(prev => {
      const monthData = (prev.privateMonths && prev.privateMonths[monthId]) || { monthId, billAmounts: {}, handledPayments: {} };
      return {
        ...prev,
        privateMonths: {
          ...(prev.privateMonths || {}),
          [monthId]: {
            ...monthData,
            billAmounts: {
              ...monthData.billAmounts,
              [billId]: amount
            }
          }
        }
      };
    });
  };

  const addPrivateBill = (bill: PrivateBill) => {
    setState(prev => ({ ...prev, privateBills: [...(prev.privateBills || []), bill] }));
  };

  const removePrivateBill = (billId: string) => {
    setState(prev => ({ ...prev, privateBills: (prev.privateBills || []).filter(b => b.id !== billId) }));
  };

  const updatePrivateBill = (bill: PrivateBill) => {
    setState(prev => ({ ...prev, privateBills: (prev.privateBills || []).map(b => b.id === bill.id ? bill : b) }));
  };

  const copyPrivateFromPreviousMonth = (monthId: string) => {
    setState(prev => {
      const allMonths = Object.keys(prev.privateMonths || {}).sort();
      const currentIndex = allMonths.indexOf(monthId);
      if (currentIndex <= 0) return prev;
      
      const prevMonthId = allMonths[currentIndex - 1];
      const prevMonth = (prev.privateMonths || {})[prevMonthId];
      if (!prevMonth) return prev;

      const currentMonthData = (prev.privateMonths && prev.privateMonths[monthId]) || { monthId, billAmounts: {}, handledPayments: {} };
      const newAmounts = { ...currentMonthData.billAmounts };

      (prev.privateBills || []).forEach(bill => {
         newAmounts[bill.id] = prevMonth.billAmounts[bill.id] !== undefined ? prevMonth.billAmounts[bill.id] : bill.defaultAmount;
      });

      return {
        ...prev,
        privateMonths: {
          ...(prev.privateMonths || {}),
          [monthId]: {
            ...currentMonthData,
            billAmounts: newAmounts
          }
        }
      };
    });
  };

  return { 
    state, updateBillAmount, addBill, removeBill, updateBill, 
    addAccount, removeAccount, updateAccount, copyFromPreviousMonth, 
    togglePaymentStatus, confirmAnomaly, unlockAccount, updateSettings,
    updatePrivateBillAmount, addPrivateBill, removePrivateBill, updatePrivateBill, copyPrivateFromPreviousMonth
  };
}

export function calculateMonth(state: AppState, monthId: string): CalculationResult {
  const monthData = state.months[monthId];
  const amounts = monthData?.billAmounts || {};
  
  const sharedAccounts = state.accounts.filter(a => a.type === 'shared');
  const personAccounts = state.accounts.filter(a => a.type === 'person');

  // Balances > 0 means they should receive money, < 0 means they owe money.
  const balances: Record<string, number> = {};
  const transfersToShared: Record<string, Record<string, number>> = {};
  
  personAccounts.forEach(p => {
    balances[p.id] = 0;
    transfersToShared[p.id] = {};
    sharedAccounts.forEach(s => {
      transfersToShared[p.id][s.id] = 0;
    });
  });


  state.bills.forEach(bill => {
    const amount = amounts[bill.id] !== undefined ? amounts[bill.id] : bill.defaultAmount;
    
    // Who paid for it natively?
    const billAccount = state.accounts.find(a => a.id === bill.accountId);
    
    // Who is liable for it?
    let liabilities: Record<string, number> = {};
    if (bill.splitType === 'equal') {
      const splitAmt = personAccounts.length > 0 ? amount / personAccounts.length : 0;
      personAccounts.forEach(p => {
        liabilities[p.id] = splitAmt;
      });
    } else {
      liabilities[bill.splitType] = amount; // specific person
    }

    if (billAccount?.type === 'shared') {
      // Bill is on shared account. No person has "paid" it yet.
      // Everyone must transfer their liability to the shared account.
      Object.keys(liabilities).forEach(personId => {
        if (transfersToShared[personId] !== undefined && transfersToShared[personId][billAccount.id] !== undefined) {
          transfersToShared[personId][billAccount.id] += liabilities[personId];
        }
      });
    } else if (billAccount?.type === 'person') {
      // Bill is paid natively by this person.
      // They get a positive credit for the amount they paid.
      if (balances[billAccount.id] !== undefined) {
        balances[billAccount.id] += amount;
      }
      
      // Everyone gets a negative debit for their liability.
      Object.keys(liabilities).forEach(personId => {
        if (balances[personId] !== undefined) {
          balances[personId] -= liabilities[personId];
        }
      });
    }
  });

  // Calculate Swishes (Splitwise algorithm)
  const debtors = Object.keys(balances).filter(id => balances[id] < -0.01).map(id => ({ id, amount: Math.abs(balances[id]) }));
  const creditors = Object.keys(balances).filter(id => balances[id] > 0.01).map(id => ({ id, amount: balances[id] }));

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const swishes: SwishTransfer[] = [];
  
  let i = 0;
  let j = 0;
  
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0.01) {
      swishes.push({ fromId: debtor.id, toId: creditor.id, amount });
    }
    
    debtor.amount -= amount;
    creditor.amount -= amount;
    
    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return { transfersToShared, swishes };
}
