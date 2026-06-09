import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { AppState, BillDefinition, CalculationResult, Account, SwishTransfer, PrivateBill } from './types';
import { runRelationalMigration } from './migrateToRelational';
import { useAuth } from './AuthContext'; // Need userId for migration

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'shared_1', name: 'Gemensamt konto', type: 'shared', transferMethod: 'transfer' },
  { id: 'person_1', name: 'Person 1', type: 'person', transferMethod: 'swish' },
  { id: 'person_2', name: 'Person 2', type: 'person', transferMethod: 'swish' }
];

const DEFAULT_STATE: AppState = {
  accounts: DEFAULT_ACCOUNTS,
  bills: [],
  months: {},
  privateBills: [],
  privateMonths: {},
  settings: { showSummary: true }
};

export function useStore(householdId: string | null) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!householdId || !user) {
      setIsCloudLoaded(false);
      return;
    }

    let mounted = true;

    const loadCloud = async () => {
      // 1. Check if migration needed
      const { data: accCheck } = await supabase.from('accounts').select('id').eq('household_id', householdId).limit(1);
      if (!accCheck || accCheck.length === 0) {
        const { data: hh } = await supabase.from('households').select('state_json').eq('id', householdId).single();
        if (hh && hh.state_json && Object.keys(hh.state_json).length > 0) {
           await runRelationalMigration(householdId, user.id);
        }
      }

      // 2. Fetch all relational data
      const [
        { data: accounts },
        { data: bills },
        { data: monthBillAmounts },
        { data: monthHandledPayments },
        { data: monthConfirmedAnomalies },
        { data: privateBills },
        { data: privateMonthAmounts },
        { data: privateMonthLocks },
        { data: privateMonthAnomalies },
        { data: settings }
      ] = await Promise.all([
        supabase.from('accounts').select('*').eq('household_id', householdId),
        supabase.from('bills').select('*').eq('household_id', householdId),
        supabase.from('month_bill_amounts').select('*').eq('household_id', householdId),
        supabase.from('month_handled_payments').select('*').eq('household_id', householdId),
        supabase.from('month_confirmed_anomalies').select('*').eq('household_id', householdId),
        supabase.from('private_bills').select('*').eq('household_id', householdId),
        supabase.from('private_month_amounts').select('*').eq('household_id', householdId),
        supabase.from('private_month_locks').select('*').eq('household_id', householdId),
        supabase.from('private_month_anomalies').select('*').eq('household_id', householdId),
        supabase.from('household_settings').select('*').eq('household_id', householdId).single()
      ]);

      if (!mounted) return;

      // 3. Reconstruct AppState
      const newState: AppState = {
        accounts: accounts ? accounts.map(a => ({ id: a.id, name: a.name, type: a.type, transferMethod: a.transfer_method })) : DEFAULT_ACCOUNTS,
        bills: bills ? bills.map(b => ({
          id: b.id, name: b.name, accountId: b.account_id, splitType: b.split_type,
          defaultAmount: Number(b.default_amount), interval: b.interval, customMonths: b.custom_months,
          warnIfZero: b.warn_if_zero, isLoan: b.is_loan, totalDebt: b.total_debt ? Number(b.total_debt) : undefined,
          isArchived: b.is_archived
        })) : [],
        months: {},
        privateBills: privateBills ? privateBills.map(b => ({
          id: b.id, userId: b.user_id, name: b.name, defaultAmount: Number(b.default_amount),
          interval: b.interval, customMonths: b.custom_months, warnIfZero: b.warn_if_zero,
          isShared: b.is_shared, isLoan: b.is_loan, totalDebt: b.total_debt ? Number(b.total_debt) : undefined,
          isArchived: b.is_archived
        })) : [],
        privateMonths: {},
        settings: settings ? { showSummary: settings.show_summary } : { showSummary: true }
      };

      // Populate months
      if (monthBillAmounts) {
        monthBillAmounts.forEach(mba => {
          if (!newState.months[mba.month_id]) newState.months[mba.month_id] = { monthId: mba.month_id, billAmounts: {}, handledPayments: {}, confirmedAnomalies: {} };
          newState.months[mba.month_id].billAmounts[mba.bill_id] = Number(mba.amount);
        });
      }
      if (monthHandledPayments) {
        monthHandledPayments.forEach(mhp => {
          if (!newState.months[mhp.month_id]) newState.months[mhp.month_id] = { monthId: mhp.month_id, billAmounts: {}, handledPayments: {}, confirmedAnomalies: {} };
          newState.months[mhp.month_id].handledPayments![mhp.payment_id] = mhp.is_handled;
        });
      }
      if (monthConfirmedAnomalies) {
        monthConfirmedAnomalies.forEach(mca => {
          if (!newState.months[mca.month_id]) newState.months[mca.month_id] = { monthId: mca.month_id, billAmounts: {}, handledPayments: {}, confirmedAnomalies: {} };
          newState.months[mca.month_id].confirmedAnomalies![mca.bill_id] = mca.is_confirmed;
        });
      }

      // Populate private months
      if (privateMonthAmounts) {
        privateMonthAmounts.forEach(pma => {
          if (!newState.privateMonths![pma.month_id]) newState.privateMonths![pma.month_id] = { monthId: pma.month_id, billAmounts: {}, handledPayments: {}, confirmedAnomalies: {} };
          newState.privateMonths![pma.month_id].billAmounts[pma.bill_id] = Number(pma.amount);
        });
      }
      if (privateMonthLocks) {
        privateMonthLocks.forEach(pml => {
          if (!newState.privateMonths![pml.month_id]) newState.privateMonths![pml.month_id] = { monthId: pml.month_id, billAmounts: {}, handledPayments: {}, confirmedAnomalies: {} };
          newState.privateMonths![pml.month_id].isLocked = pml.is_locked;
        });
      }
      if (privateMonthAnomalies) {
        privateMonthAnomalies.forEach(pma => {
          if (!newState.privateMonths![pma.month_id]) newState.privateMonths![pma.month_id] = { monthId: pma.month_id, billAmounts: {}, handledPayments: {}, confirmedAnomalies: {} };
          newState.privateMonths![pma.month_id].confirmedAnomalies![pma.bill_id] = pma.is_confirmed;
        });
      }

      setState(newState);
      setIsCloudLoaded(true);
    };

    loadCloud();

    // 4. Realtime subscriptions (Reload everything on any change for simplicity to ensure consistency)
    // To avoid massive state-merging logic, a change triggers a full refetch. 
    // Since Supabase fetches are fast, this guarantees zero client divergence.
    let debounceTimer: ReturnType<typeof setTimeout>;
    const handleRealtimeUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (mounted) loadCloud();
      }, 500);
    };

    const channel = supabase.channel(`household_${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts', filter: `household_id=eq.${householdId}` }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `household_id=eq.${householdId}` }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'month_bill_amounts', filter: `household_id=eq.${householdId}` }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'month_handled_payments', filter: `household_id=eq.${householdId}` }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'month_confirmed_anomalies', filter: `household_id=eq.${householdId}` }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_bills', filter: `household_id=eq.${householdId}` }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_month_amounts', filter: `household_id=eq.${householdId}` }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_month_locks', filter: `household_id=eq.${householdId}` }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_month_anomalies', filter: `household_id=eq.${householdId}` }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_settings', filter: `household_id=eq.${householdId}` }, handleRealtimeUpdate)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      clearTimeout(debounceTimer);
    };
  }, [householdId, user]);

  // MUTATIONS (Optimistic UI + Supabase Push)

  const updateBillAmount = async (monthId: string, billId: string, amount: number) => {
    setState(prev => {
      const monthData = prev.months[monthId] || { monthId, billAmounts: {}, handledPayments: {} };
      return { ...prev, months: { ...prev.months, [monthId]: { ...monthData, billAmounts: { ...monthData.billAmounts, [billId]: amount } } } };
    });
    if (householdId) {
      await supabase.from('month_bill_amounts').upsert({ household_id: householdId, month_id: monthId, bill_id: billId, amount }, { onConflict: 'household_id,month_id,bill_id' });
    }
  };

  const addBill = async (bill: BillDefinition) => {
    setState(prev => ({ ...prev, bills: [...prev.bills, bill] }));
    if (householdId) {
      await supabase.from('bills').insert({ id: bill.id, household_id: householdId, name: bill.name, account_id: bill.accountId, split_type: bill.splitType, default_amount: bill.defaultAmount, interval: bill.interval, custom_months: bill.customMonths || [], warn_if_zero: bill.warnIfZero, is_loan: bill.isLoan, total_debt: bill.totalDebt });
    }
  };

  const removeBill = async (billId: string) => {
    setState(prev => ({ ...prev, bills: prev.bills.map(b => b.id === billId ? { ...b, isArchived: true } : b) }));
    if (householdId) {
      await supabase.from('bills').update({ is_archived: true }).eq('id', billId).eq('household_id', householdId);
    }
  };

  const updateBill = async (bill: BillDefinition) => {
    setState(prev => ({ ...prev, bills: prev.bills.map(b => b.id === bill.id ? bill : b) }));
    if (householdId) {
      await supabase.from('bills').update({ name: bill.name, account_id: bill.accountId, split_type: bill.splitType, default_amount: bill.defaultAmount, interval: bill.interval, custom_months: bill.customMonths || [], warn_if_zero: bill.warnIfZero, is_loan: bill.isLoan, total_debt: bill.totalDebt }).eq('id', bill.id).eq('household_id', householdId);
    }
  };

  const addAccount = async (account: Account) => {
    setState(prev => ({ ...prev, accounts: [...prev.accounts, account] }));
    if (householdId) {
      await supabase.from('accounts').insert({ id: account.id, household_id: householdId, name: account.name, type: account.type, transfer_method: account.transferMethod });
    }
  };

  const removeAccount = async (accountId: string) => {
    setState(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== accountId) }));
    if (householdId) {
      await supabase.from('accounts').delete().eq('id', accountId).eq('household_id', householdId);
    }
  };

  const updateAccount = async (account: Account) => {
    setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === account.id ? account : a) }));
    if (householdId) {
      await supabase.from('accounts').update({ name: account.name, type: account.type, transfer_method: account.transferMethod }).eq('id', account.id).eq('household_id', householdId);
    }
  };

  const copyFromPreviousMonth = async (monthId: string) => {
    // Client-side logic for simplicity, pushing each amount to DB
    const allMonths = Object.keys(state.months).sort();
    const currentIndex = allMonths.indexOf(monthId);
    if (currentIndex <= 0) return;
    
    const prevMonthId = allMonths[currentIndex - 1];
    const prevMonth = state.months[prevMonthId];
    if (!prevMonth) return;

    const currentMonthData = state.months[monthId] || { monthId, billAmounts: {}, handledPayments: {} };
    const handled = currentMonthData.handledPayments || {};
    const lockedAccounts = new Set<string>();
    Object.keys(handled).forEach(paymentId => {
      if (handled[paymentId]) {
        if (paymentId.startsWith('transfer_')) {
          const parts = paymentId.split('_');
          if (parts.length >= 3) {
            lockedAccounts.add(parts[1]); lockedAccounts.add(parts[2]);
          }
        } else if (paymentId.startsWith('swish_')) {
          const [, fromId, toId] = paymentId.split('_');
          lockedAccounts.add(fromId); lockedAccounts.add(toId);
        }
      }
    });

    const newAmounts: Record<string, number> = {};
    state.bills.forEach(bill => {
       if (!bill.isArchived && !lockedAccounts.has(bill.accountId)) {
         newAmounts[bill.id] = prevMonth.billAmounts[bill.id] !== undefined ? prevMonth.billAmounts[bill.id] : bill.defaultAmount;
       }
    });

    setState(prev => {
      return { ...prev, months: { ...prev.months, [monthId]: { ...(prev.months[monthId]||{}), billAmounts: { ...currentMonthData.billAmounts, ...newAmounts } } } };
    });

    if (householdId) {
      const inserts = Object.entries(newAmounts).map(([billId, amt]) => ({ household_id: householdId, month_id: monthId, bill_id: billId, amount: amt }));
      if (inserts.length > 0) {
        await supabase.from('month_bill_amounts').upsert(inserts, { onConflict: 'household_id,month_id,bill_id' });
      }
    }
  };

  const togglePaymentStatus = async (monthId: string, paymentId: string) => {
    let newVal = false;
    setState(prev => {
      const monthData = prev.months[monthId] || { monthId, billAmounts: {}, handledPayments: {} };
      const currentHandled = monthData.handledPayments || {};
      newVal = !currentHandled[paymentId];
      return { ...prev, months: { ...prev.months, [monthId]: { ...monthData, handledPayments: { ...currentHandled, [paymentId]: newVal } } } };
    });
    if (householdId) {
      await supabase.from('month_handled_payments').upsert({ household_id: householdId, month_id: monthId, payment_id: paymentId, is_handled: newVal }, { onConflict: 'household_id,month_id,payment_id' });
    }
  };

  const confirmAnomaly = async (monthId: string, billId: string) => {
    setState(prev => {
      const monthData = prev.months[monthId] || { monthId, billAmounts: {}, handledPayments: {} };
      return { ...prev, months: { ...prev.months, [monthId]: { ...monthData, confirmedAnomalies: { ...(monthData.confirmedAnomalies||{}), [billId]: true } } } };
    });
    if (householdId) {
      await supabase.from('month_confirmed_anomalies').upsert({ household_id: householdId, month_id: monthId, bill_id: billId, is_confirmed: true }, { onConflict: 'household_id,month_id,bill_id' });
    }
  };

  const unlockAccount = async (monthId: string, accountId: string) => {
    let unhandledPayments: string[] = [];
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
                unhandledPayments.push(paymentId);
              }
            }
          } else if (paymentId.startsWith('swish_')) {
            const [, fromId, toId] = paymentId.split('_');
            if (accountId === fromId || accountId === toId) {
              newHandled[paymentId] = false;
              unhandledPayments.push(paymentId);
            }
          }
        }
      });

      return { ...prev, months: { ...prev.months, [monthId]: { ...monthData, handledPayments: newHandled } } };
    });

    if (householdId && unhandledPayments.length > 0) {
      const updates = unhandledPayments.map(pid => ({ household_id: householdId, month_id: monthId, payment_id: pid, is_handled: false }));
      await supabase.from('month_handled_payments').upsert(updates, { onConflict: 'household_id,month_id,payment_id' });
    }
  };

  const updateSettings = async (settingsUpdates: Partial<AppState['settings']> | undefined) => {
    if (!settingsUpdates) return;
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...settingsUpdates } }));
    if (householdId) {
      await supabase.from('household_settings').upsert({ household_id: householdId, show_summary: settingsUpdates.showSummary !== false }, { onConflict: 'household_id' });
    }
  };

  // Private methods
  const updatePrivateBillAmount = async (monthId: string, billId: string, amount: number) => {
    setState(prev => {
      const pMonths = prev.privateMonths || {};
      const mData = pMonths[monthId] || { monthId, billAmounts: {} };
      return { ...prev, privateMonths: { ...pMonths, [monthId]: { ...mData, billAmounts: { ...mData.billAmounts, [billId]: amount } } } };
    });
    if (householdId && user) {
      await supabase.from('private_month_amounts').upsert({ household_id: householdId, user_id: user.id, month_id: monthId, bill_id: billId, amount }, { onConflict: 'household_id,user_id,month_id,bill_id' });
    }
  };

  const addPrivateBill = async (bill: PrivateBill) => {
    setState(prev => ({ ...prev, privateBills: [...(prev.privateBills||[]), bill] }));
    if (householdId && user) {
      await supabase.from('private_bills').insert({ id: bill.id, household_id: householdId, user_id: user.id, name: bill.name, default_amount: bill.defaultAmount, interval: bill.interval, custom_months: bill.customMonths || [], warn_if_zero: bill.warnIfZero, is_shared: bill.isShared, is_loan: bill.isLoan, total_debt: bill.totalDebt });
    }
  };

  const removePrivateBill = async (billId: string) => {
    setState(prev => ({ ...prev, privateBills: (prev.privateBills||[]).map(b => b.id === billId ? { ...b, isArchived: true } : b) }));
    if (householdId && user) {
      await supabase.from('private_bills').update({ is_archived: true }).eq('id', billId).eq('household_id', householdId).eq('user_id', user.id);
    }
  };

  const updatePrivateBill = async (bill: PrivateBill) => {
    setState(prev => ({ ...prev, privateBills: (prev.privateBills||[]).map(b => b.id === bill.id ? bill : b) }));
    if (householdId && user) {
      await supabase.from('private_bills').update({ name: bill.name, default_amount: bill.defaultAmount, interval: bill.interval, custom_months: bill.customMonths || [], warn_if_zero: bill.warnIfZero, is_shared: bill.isShared, is_loan: bill.isLoan, total_debt: bill.totalDebt }).eq('id', bill.id).eq('household_id', householdId).eq('user_id', user.id);
    }
  };

  const copyPrivateFromPreviousMonth = async (monthId: string) => {
    const allMonths = Object.keys(state.privateMonths || {}).sort();
    const currentIndex = allMonths.indexOf(monthId);
    if (currentIndex <= 0) return;
    
    const prevMonthId = allMonths[currentIndex - 1];
    const prevMonth = (state.privateMonths || {})[prevMonthId];
    if (!prevMonth) return;

    const currentMonthData = (state.privateMonths && state.privateMonths[monthId]) || { monthId, billAmounts: {}, handledPayments: {} };
    if (currentMonthData.isLocked) return;
    const newAmounts: Record<string, number> = {};

    (state.privateBills || []).forEach(bill => {
      if (!bill.isArchived) {
        newAmounts[bill.id] = prevMonth.billAmounts[bill.id] !== undefined ? prevMonth.billAmounts[bill.id] : bill.defaultAmount;
      }
    });

    setState(prev => {
      return { ...prev, privateMonths: { ...(prev.privateMonths || {}), [monthId]: { ...currentMonthData, billAmounts: { ...currentMonthData.billAmounts, ...newAmounts } } } };
    });

    if (householdId && user) {
      const inserts = Object.entries(newAmounts).map(([billId, amt]) => ({ household_id: householdId, user_id: user.id, month_id: monthId, bill_id: billId, amount: amt }));
      if (inserts.length > 0) {
        await supabase.from('private_month_amounts').upsert(inserts, { onConflict: 'household_id,user_id,month_id,bill_id' });
      }
    }
  };

  const confirmPrivateAnomaly = async (monthId: string, billId: string) => {
    setState(prev => {
      const pMonths = prev.privateMonths || {};
      const mData = pMonths[monthId] || { monthId, billAmounts: {} };
      return { ...prev, privateMonths: { ...pMonths, [monthId]: { ...mData, confirmedAnomalies: { ...(mData.confirmedAnomalies||{}), [billId]: true } } } };
    });
    if (householdId && user) {
      await supabase.from('private_month_anomalies').upsert({ household_id: householdId, user_id: user.id, month_id: monthId, bill_id: billId, is_confirmed: true }, { onConflict: 'household_id,user_id,month_id,bill_id' });
    }
  };

  const togglePrivateLock = async (monthId: string) => {
    let newVal = false;
    setState(prev => {
      const pMonths = prev.privateMonths || {};
      const mData = pMonths[monthId] || { monthId, billAmounts: {} };
      newVal = !mData.isLocked;
      return { ...prev, privateMonths: { ...pMonths, [monthId]: { ...mData, isLocked: newVal } } };
    });
    if (householdId && user) {
      await supabase.from('private_month_locks').upsert({ household_id: householdId, user_id: user.id, month_id: monthId, is_locked: newVal }, { onConflict: 'household_id,user_id,month_id' });
    }
  };

  return {
    state,
    isCloudLoaded,
    updateBillAmount,
    addBill,
    removeBill,
    updateBill,
    addAccount,
    removeAccount,
    updateAccount,
    copyFromPreviousMonth,
    togglePaymentStatus,
    confirmAnomaly,
    unlockAccount,
    updateSettings,
    updatePrivateBillAmount,
    addPrivateBill,
    removePrivateBill,
    updatePrivateBill,
    copyPrivateFromPreviousMonth,
    confirmPrivateAnomaly,
    togglePrivateLock
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
