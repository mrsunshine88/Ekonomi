import { create } from 'zustand';
import { supabase } from './supabase';
import type { AppState, BillDefinition, CalculationResult, Account, SwishTransfer, PrivateBill } from './types';
import toast from 'react-hot-toast';
import { runRelationalMigration } from './migrateToRelational';
import { safeParseAmount, safeParseBill, safeParseAccount, safeParsePrivateBill } from './validators';

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

export const safeDb = async (promise: PromiseLike<any>, rollbackFn?: () => void) => {
  try {
    const { error } = await promise;
    if (error) {
      console.error('Supabase error:', error);
      toast.error(`Databasfel: ${error.message || error.details || 'Okänt fel'}`);
      if (rollbackFn) rollbackFn();
      return { error };
    }
    return { error: null };
  } catch (err) {
    console.error('Unexpected error:', err);
    toast.error('Nätverksfel. Försök igen.');
    if (rollbackFn) rollbackFn();
    return { error: err };
  }
};

interface StoreState {
  state: AppState;
  isCloudLoaded: boolean;
  householdId: string | null;
  userId: string | null;
  channel: any;

  initCloud: (householdId: string | null, userId: string | null) => void;
  loadYear: (year: string) => Promise<void>;
  cleanup: () => void;
  
  updateBillAmount: (monthId: string, billId: string, amount: number) => Promise<void>;
  addBill: (bill: BillDefinition) => Promise<void>;
  removeBill: (billId: string) => Promise<void>;
  updateBill: (bill: BillDefinition) => Promise<void>;
  addAccount: (account: Account) => Promise<void>;
  removeAccount: (accountId: string) => Promise<void>;
  updateAccount: (account: Account) => Promise<void>;
  copyFromPreviousMonth: (monthId: string) => Promise<void>;
  togglePaymentStatus: (monthId: string, paymentId: string) => Promise<void>;
  confirmAnomaly: (monthId: string, billId: string) => Promise<void>;
  unlockAccount: (monthId: string, accountId: string) => Promise<void>;
  updateSettings: (settingsUpdates: Partial<AppState['settings']> | undefined) => Promise<void>;
  toggleSharePrivateEconomy: (share: boolean) => Promise<void>;
  
  updatePrivateBillAmount: (monthId: string, billId: string, amount: number) => Promise<void>;
  addPrivateBill: (bill: PrivateBill) => Promise<void>;
  removePrivateBill: (billId: string) => Promise<void>;
  updatePrivateBill: (bill: PrivateBill) => Promise<void>;
  copyPrivateFromPreviousMonth: (monthId: string) => Promise<void>;
  confirmPrivateAnomaly: (monthId: string, billId: string) => Promise<void>;
  togglePrivateLock: (monthId: string) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  state: DEFAULT_STATE,
  isCloudLoaded: false,
  householdId: null,
  userId: null,
  channel: null,

  cleanup: () => {
    const { channel } = get();
    if (channel) {
      supabase.removeChannel(channel);
    }
    set({ state: DEFAULT_STATE, channel: null, isCloudLoaded: false, householdId: null, userId: null });
  },

  initCloud: async (householdId, userId) => {
    if (!householdId || !userId) {
      get().cleanup();
      return;
    }
    set({ householdId, userId });

    const loadCloud = async () => {
      const { data: accCheck } = await supabase.from('accounts').select('id').eq('household_id', householdId).limit(1);
      if (!accCheck || accCheck.length === 0) {
        const { data: hh } = await supabase.from('households').select('state_json').eq('id', householdId).single();
        if (hh && hh.state_json && Object.keys(hh.state_json).length > 0) {
          await runRelationalMigration(householdId, userId);
        }
      }

      // 2. Fetch all relational data
      const currentYear = new Date().getFullYear();
      const lastYearDec = `${currentYear - 1}-12`;

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
        { data: settings },
        { data: profiles }
      ] = await Promise.all([
        supabase.from('accounts').select('*').eq('household_id', householdId),
        supabase.from('bills').select('*').eq('household_id', householdId),
        supabase.from('month_bill_amounts').select('*').eq('household_id', householdId).gte('month_id', lastYearDec),
        supabase.from('month_handled_payments').select('*').eq('household_id', householdId).gte('month_id', lastYearDec),
        supabase.from('month_confirmed_anomalies').select('*').eq('household_id', householdId).gte('month_id', lastYearDec),
        supabase.from('private_bills').select('*').eq('household_id', householdId),
        supabase.from('private_month_amounts').select('*').eq('household_id', householdId).gte('month_id', lastYearDec),
        supabase.from('private_month_locks').select('*').eq('household_id', householdId).gte('month_id', lastYearDec),
        supabase.from('private_month_anomalies').select('*').eq('household_id', householdId).gte('month_id', lastYearDec),
        supabase.from('household_settings').select('*').eq('household_id', householdId).maybeSingle(),
        supabase.from('profiles').select('id, display_name, share_private_economy, household_id').eq('household_id', householdId)
      ]);

      // 3. Reconstruct AppState
      const newState: AppState = {
        accounts: accounts ? accounts.map(a => ({ id: a.id, name: a.name, type: a.type, transferMethod: a.transfer_method })) : DEFAULT_ACCOUNTS,
        bills: bills ? bills.map(b => ({
          id: b.id, name: b.name, accountId: b.account_id, splitType: b.split_type,
          defaultAmount: Number(b.default_amount), interval: b.interval, customMonths: b.custom_months,
          warnIfZero: b.warn_if_zero, isLoan: b.is_loan, totalDebt: b.total_debt ? Number(b.total_debt) : undefined,
          isArchived: b.is_archived, isAutoTransfer: b.is_auto_transfer || undefined, startMonth: b.start_month
        })) : [],
        months: {},
        privateBills: privateBills ? privateBills.map(b => ({
          id: b.id, userId: b.user_id, name: b.name, defaultAmount: Number(b.default_amount),
          interval: b.interval, customMonths: b.custom_months, warnIfZero: b.warn_if_zero,
          isShared: b.is_shared, isLoan: b.is_loan, totalDebt: b.total_debt ? Number(b.total_debt) : undefined,
          isArchived: b.is_archived, startMonth: b.start_month
        })) : [],
        privateMonths: {},
        householdProfiles: profiles ? profiles.map(p => ({
          id: p.id, display_name: p.display_name, share_private_economy: p.share_private_economy
        })) : [],
        settings: settings ? { showSummary: settings.show_summary } : { showSummary: true }
      };

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

      set({ state: newState, isCloudLoaded: true });
    };

    loadCloud();

    let debounceTimer: ReturnType<typeof setTimeout>;
    const handleRealtimeUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadCloud();
      }, 500);
    };

    const oldChannel = get().channel;
    if (oldChannel) supabase.removeChannel(oldChannel);

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

    set({ channel });
  },

  loadYear: async (year: string) => {
    const { householdId, state } = get();
    if (!householdId) return;

    const start = `${year}-01`;
    const end = `${year}-12`;

    const [
      { data: monthBillAmounts },
      { data: monthHandledPayments },
      { data: monthConfirmedAnomalies },
      { data: privateMonthAmounts },
      { data: privateMonthLocks },
      { data: privateMonthAnomalies }
    ] = await Promise.all([
      supabase.from('month_bill_amounts').select('*').eq('household_id', householdId).gte('month_id', start).lte('month_id', end),
      supabase.from('month_handled_payments').select('*').eq('household_id', householdId).gte('month_id', start).lte('month_id', end),
      supabase.from('month_confirmed_anomalies').select('*').eq('household_id', householdId).gte('month_id', start).lte('month_id', end),
      supabase.from('private_month_amounts').select('*').eq('household_id', householdId).gte('month_id', start).lte('month_id', end),
      supabase.from('private_month_locks').select('*').eq('household_id', householdId).gte('month_id', start).lte('month_id', end),
      supabase.from('private_month_anomalies').select('*').eq('household_id', householdId).gte('month_id', start).lte('month_id', end)
    ]);

    const newState = { ...state, months: { ...state.months }, privateMonths: { ...state.privateMonths } };

    if (monthBillAmounts) {
      monthBillAmounts.forEach(mba => {
        if (!newState.months[mba.month_id]) newState.months[mba.month_id] = { monthId: mba.month_id, billAmounts: {}, handledPayments: {}, confirmedAnomalies: {} };
        newState.months[mba.month_id].billAmounts[mba.bill_id] = Number(mba.amount);
      });
    }
    if (monthHandledPayments) {
      monthHandledPayments.forEach(mhp => {
        if (!newState.months[mhp.month_id]) newState.months[mhp.month_id] = { monthId: mhp.month_id, billAmounts: {}, handledPayments: {}, confirmedAnomalies: {} };
        if (!newState.months[mhp.month_id].handledPayments) newState.months[mhp.month_id].handledPayments = {};
        newState.months[mhp.month_id].handledPayments![mhp.payment_id] = mhp.is_handled;
      });
    }
    if (monthConfirmedAnomalies) {
      monthConfirmedAnomalies.forEach(mca => {
        if (!newState.months[mca.month_id]) newState.months[mca.month_id] = { monthId: mca.month_id, billAmounts: {}, handledPayments: {}, confirmedAnomalies: {} };
        if (!newState.months[mca.month_id].confirmedAnomalies) newState.months[mca.month_id].confirmedAnomalies = {};
        newState.months[mca.month_id].confirmedAnomalies![mca.bill_id] = true;
      });
    }

    if (privateMonthAmounts) {
      privateMonthAmounts.forEach(pma => {
        if (!newState.privateMonths[pma.month_id]) newState.privateMonths[pma.month_id] = { monthId: pma.month_id, billAmounts: {}, isLocked: false, confirmedAnomalies: {} };
        newState.privateMonths[pma.month_id].billAmounts[pma.bill_id] = Number(pma.amount);
      });
    }
    if (privateMonthLocks) {
      privateMonthLocks.forEach(pml => {
        if (!newState.privateMonths[pml.month_id]) newState.privateMonths[pml.month_id] = { monthId: pml.month_id, billAmounts: {}, isLocked: false, confirmedAnomalies: {} };
        newState.privateMonths[pml.month_id].isLocked = pml.is_locked;
      });
    }
    if (privateMonthAnomalies) {
      privateMonthAnomalies.forEach(pma => {
        if (!newState.privateMonths[pma.month_id]) newState.privateMonths[pma.month_id] = { monthId: pma.month_id, billAmounts: {}, isLocked: false, confirmedAnomalies: {} };
        if (!newState.privateMonths[pma.month_id].confirmedAnomalies) newState.privateMonths[pma.month_id].confirmedAnomalies = {};
        newState.privateMonths[pma.month_id].confirmedAnomalies![pma.bill_id] = true;
      });
    }

    set({ state: newState });
  },

  updateBillAmount: async (monthId, billId, amount) => {
    const parseRes = safeParseAmount(amount);
    if (!parseRes.success) {
      toast.error(parseRes.error.issues[0].message);
      return;
    }
    const validatedAmount = parseRes.data;

    const prevState = get().state;
    const { householdId, state } = get();
    const monthData = state.months[monthId] || { monthId, billAmounts: {}, handledPayments: {} };
    set({ state: { ...state, months: { ...state.months, [monthId]: { ...monthData, billAmounts: { ...monthData.billAmounts, [billId]: validatedAmount } } } } });
    if (householdId) {
      await safeDb(
        supabase.from('month_bill_amounts').upsert({ household_id: householdId, month_id: monthId, bill_id: billId, amount: validatedAmount }, { onConflict: 'household_id,month_id,bill_id' }),
        () => set({ state: prevState })
      );
    }
  },

  addBill: async (bill) => {
    const parseRes = safeParseBill(bill);
    if (!parseRes.success) {
      toast.error(parseRes.error.issues[0].message);
      return;
    }
    const validBill = parseRes.data as BillDefinition;

    // Sätt start_month för att undvika att räkningen syns bakåt i tiden
    const currentMonth = new Date().toISOString().slice(0, 7);
    validBill.startMonth = currentMonth;

    const { householdId, state } = get();
    set({ state: { ...state, bills: [...state.bills, validBill] } });
    if (householdId) {
      await safeDb(supabase.from('bills').insert({ id: validBill.id, household_id: householdId, name: validBill.name, account_id: validBill.accountId, split_type: validBill.splitType, default_amount: validBill.defaultAmount, interval: validBill.interval, custom_months: validBill.customMonths || [], warn_if_zero: validBill.warnIfZero, is_loan: validBill.isLoan, total_debt: validBill.totalDebt, is_auto_transfer: validBill.isAutoTransfer, start_month: validBill.startMonth }));
    }
  },

  removeBill: async (billId) => {
    const { householdId, state } = get();
    set({ state: { ...state, bills: state.bills.map(b => b.id === billId ? { ...b, isArchived: true } : b) } });
    if (householdId) {
      await safeDb(supabase.from('bills').update({ is_archived: true }).eq('id', billId).eq('household_id', householdId));
    }
  },

  updateBill: async (bill) => {
    const parseRes = safeParseBill(bill);
    if (!parseRes.success) {
      toast.error(parseRes.error.issues[0].message);
      return;
    }
    const validBill = parseRes.data as BillDefinition;

    const { householdId, state } = get();
    set({ state: { ...state, bills: state.bills.map(b => b.id === validBill.id ? validBill : b) } });
    if (householdId) {
      await safeDb(supabase.from('bills').update({ name: validBill.name, account_id: validBill.accountId, split_type: validBill.splitType, default_amount: validBill.defaultAmount, interval: validBill.interval, custom_months: validBill.customMonths || [], warn_if_zero: validBill.warnIfZero, is_loan: validBill.isLoan, total_debt: validBill.totalDebt, is_auto_transfer: validBill.isAutoTransfer || null }).eq('id', validBill.id).eq('household_id', householdId));
    }
  },

  addAccount: async (account) => {
    const parseRes = safeParseAccount(account);
    if (!parseRes.success) {
      toast.error(parseRes.error.issues[0].message);
      return;
    }
    const validAcc = parseRes.data as Account;

    const { householdId, state } = get();
    set({ state: { ...state, accounts: [...state.accounts, validAcc] } });
    if (householdId) {
      await safeDb(supabase.from('accounts').insert({ id: validAcc.id, household_id: householdId, name: validAcc.name, type: validAcc.type, transfer_method: validAcc.transferMethod }));
    }
  },

  removeAccount: async (accountId) => {
    const { householdId, state } = get();
    set({ state: { ...state, accounts: state.accounts.filter(a => a.id !== accountId) } });
    if (householdId) {
      await safeDb(supabase.from('accounts').delete().eq('id', accountId).eq('household_id', householdId));
    }
  },

  updateAccount: async (account) => {
    const parseRes = safeParseAccount(account);
    if (!parseRes.success) {
      toast.error(parseRes.error.issues[0].message);
      return;
    }
    const validAcc = parseRes.data as Account;

    const { householdId, state } = get();
    set({ state: { ...state, accounts: state.accounts.map(a => a.id === validAcc.id ? validAcc : a) } });
    if (householdId) {
      await safeDb(supabase.from('accounts').update({ name: validAcc.name, type: validAcc.type, transfer_method: validAcc.transferMethod }).eq('id', validAcc.id).eq('household_id', householdId));
    }
  },

  copyFromPreviousMonth: async (monthId) => {
    const { householdId, state } = get();
    
    const [yStr, mStr] = monthId.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    const prevMonthId = `${y}-${m.toString().padStart(2, '0')}`;
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

    set({ state: { ...state, months: { ...state.months, [monthId]: { ...currentMonthData, billAmounts: { ...currentMonthData.billAmounts, ...newAmounts } } } } });

    if (householdId) {
      const inserts = Object.entries(newAmounts).map(([billId, amt]) => ({ household_id: householdId, month_id: monthId, bill_id: billId, amount: amt }));
      if (inserts.length > 0) {
        await safeDb(supabase.from('month_bill_amounts').upsert(inserts, { onConflict: 'household_id,month_id,bill_id' }));
      }
    }
  },

  togglePaymentStatus: async (monthId, paymentId) => {
    const prevState = get().state;
    const { householdId, state } = get();
    const monthData = state.months[monthId] || { monthId, billAmounts: {}, handledPayments: {} };
    const handled = monthData.handledPayments || {};
    const newStatus = !handled[paymentId];
    
    set({ state: { ...state, months: { ...state.months, [monthId]: { ...monthData, handledPayments: { ...handled, [paymentId]: newStatus } } } } });
    
    if (householdId) {
      await safeDb(
        supabase.from('month_handled_payments').upsert({ household_id: householdId, month_id: monthId, payment_id: paymentId, is_handled: newStatus }, { onConflict: 'household_id,month_id,payment_id' }),
        () => set({ state: prevState })
      );
    }
  },

  confirmAnomaly: async (monthId, billId) => {
    const { householdId, state } = get();
    const monthData = state.months[monthId] || { monthId, billAmounts: {}, handledPayments: {} };
    set({ state: { ...state, months: { ...state.months, [monthId]: { ...monthData, confirmedAnomalies: { ...(monthData.confirmedAnomalies||{}), [billId]: true } } } } });
    if (householdId) {
      await safeDb(supabase.from('month_confirmed_anomalies').upsert({ household_id: householdId, month_id: monthId, bill_id: billId, is_confirmed: true }, { onConflict: 'household_id,month_id,bill_id' }));
    }
  },

  unlockAccount: async (monthId, accountId) => {
    const { householdId, state } = get();
    let unhandledPayments: string[] = [];
    const monthData = state.months[monthId];
    if (!monthData || !monthData.handledPayments) return;
    
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

    set({ state: { ...state, months: { ...state.months, [monthId]: { ...monthData, handledPayments: newHandled } } } });

    if (householdId && unhandledPayments.length > 0) {
      const updates = unhandledPayments.map(pid => ({ household_id: householdId, month_id: monthId, payment_id: pid, is_handled: false }));
      await safeDb(supabase.from('month_handled_payments').upsert(updates, { onConflict: 'household_id,month_id,payment_id' }));
    }
  },

  updateSettings: async (settingsUpdates) => {
    if (!settingsUpdates) return;
    const { householdId, state } = get();
    set({ state: { ...state, settings: { ...state.settings, ...settingsUpdates } } });
    if (householdId) {
      await safeDb(supabase.from('household_settings').upsert({ household_id: householdId, show_summary: settingsUpdates.showSummary !== false }, { onConflict: 'household_id' }));
    }
  },

  toggleSharePrivateEconomy: async (share: boolean) => {
    const { userId, state } = get();
    if (!userId) return;
    
    // Update local state
    const profiles = state.householdProfiles || [];
    const updatedProfiles = profiles.map(p => p.id === userId ? { ...p, share_private_economy: share } : p);
    set({ state: { ...state, householdProfiles: updatedProfiles } });
    
    // Update DB
    await safeDb(supabase.from('profiles').update({ share_private_economy: share }).eq('id', userId));
  },

  updatePrivateBillAmount: async (monthId, billId, amount) => {
    const parseRes = safeParseAmount(amount);
    if (!parseRes.success) {
      toast.error(parseRes.error.issues[0].message);
      return;
    }
    const validatedAmount = parseRes.data;

    const prevState = get().state;
    const { householdId, userId, state } = get();
    const pMonths = state.privateMonths || {};
    const mData = pMonths[monthId] || { monthId, billAmounts: {} };
    set({ state: { ...state, privateMonths: { ...pMonths, [monthId]: { ...mData, billAmounts: { ...mData.billAmounts, [billId]: validatedAmount } } } } });
    if (householdId && userId) {
      await safeDb(
        supabase.from('private_month_amounts').upsert({ household_id: householdId, user_id: userId, month_id: monthId, bill_id: billId, amount: validatedAmount }, { onConflict: 'household_id,user_id,month_id,bill_id' }),
        () => set({ state: prevState })
      );
    }
  },

  addPrivateBill: async (bill) => {
    const parseRes = safeParsePrivateBill(bill);
    if (!parseRes.success) {
      toast.error(parseRes.error.issues[0].message);
      return;
    }
    const validBill = parseRes.data as PrivateBill;

    // Sätt start_month för att undvika att räkningen syns bakåt i tiden
    const currentMonth = new Date().toISOString().slice(0, 7);
    validBill.startMonth = currentMonth;

    const { householdId, userId, state } = get();
    set({ state: { ...state, privateBills: [...(state.privateBills||[]), validBill] } });
    if (householdId && userId) {
      await safeDb(supabase.from('private_bills').insert({ id: validBill.id, household_id: householdId, user_id: userId, name: validBill.name, default_amount: validBill.defaultAmount, interval: validBill.interval, custom_months: validBill.customMonths || [], warn_if_zero: validBill.warnIfZero, is_shared: validBill.isShared, is_loan: validBill.isLoan, total_debt: validBill.totalDebt, start_month: validBill.startMonth }));
    }
  },

  removePrivateBill: async (billId) => {
    const { householdId, userId, state } = get();
    set({ state: { ...state, privateBills: (state.privateBills||[]).map(b => b.id === billId ? { ...b, isArchived: true } : b) } });
    if (householdId && userId) {
      await safeDb(supabase.from('private_bills').update({ is_archived: true }).eq('id', billId).eq('household_id', householdId).eq('user_id', userId));
    }
  },

  updatePrivateBill: async (bill) => {
    const parseRes = safeParsePrivateBill(bill);
    if (!parseRes.success) {
      toast.error(parseRes.error.issues[0].message);
      return;
    }
    const validBill = parseRes.data as PrivateBill;

    const { householdId, userId, state } = get();
    set({ state: { ...state, privateBills: (state.privateBills||[]).map(b => b.id === validBill.id ? validBill : b) } });
    if (householdId && userId) {
      await safeDb(supabase.from('private_bills').update({ name: validBill.name, default_amount: validBill.defaultAmount, interval: validBill.interval, custom_months: validBill.customMonths || [], warn_if_zero: validBill.warnIfZero, is_shared: validBill.isShared, is_loan: validBill.isLoan, total_debt: validBill.totalDebt }).eq('id', validBill.id).eq('household_id', householdId).eq('user_id', userId));
    }
  },

  copyPrivateFromPreviousMonth: async (monthId) => {
    const { householdId, userId, state } = get();
    
    const [yStr, mStr] = monthId.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    const prevMonthId = `${y}-${m.toString().padStart(2, '0')}`;
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

    set({ state: { ...state, privateMonths: { ...(state.privateMonths || {}), [monthId]: { ...currentMonthData, billAmounts: { ...currentMonthData.billAmounts, ...newAmounts } } } } });

    if (householdId && userId) {
      const inserts = Object.entries(newAmounts).map(([billId, amt]) => ({ household_id: householdId, user_id: userId, month_id: monthId, bill_id: billId, amount: amt }));
      if (inserts.length > 0) {
        await safeDb(supabase.from('private_month_amounts').upsert(inserts, { onConflict: 'household_id,user_id,month_id,bill_id' }));
      }
    }
  },

  confirmPrivateAnomaly: async (monthId, billId) => {
    const { householdId, userId, state } = get();
    const pMonths = state.privateMonths || {};
    const mData = pMonths[monthId] || { monthId, billAmounts: {} };
    set({ state: { ...state, privateMonths: { ...pMonths, [monthId]: { ...mData, confirmedAnomalies: { ...(mData.confirmedAnomalies||{}), [billId]: true } } } } });
    if (householdId && userId) {
      await safeDb(supabase.from('private_month_anomalies').upsert({ household_id: householdId, user_id: userId, month_id: monthId, bill_id: billId, is_confirmed: true }, { onConflict: 'household_id,user_id,month_id,bill_id' }));
    }
  },

  togglePrivateLock: async (monthId) => {
    const prevState = get().state;
    const { householdId, userId, state } = get();
    const pMonths = state.privateMonths || {};
    const mData = pMonths[monthId] || { monthId, billAmounts: {} };
    const newStatus = !mData.isLocked;
    
    set({ state: { ...state, privateMonths: { ...pMonths, [monthId]: { ...mData, isLocked: newStatus } } } });
    if (householdId && userId) {
      await safeDb(
        supabase.from('private_month_locks').upsert({ household_id: householdId, user_id: userId, month_id: monthId, is_locked: newStatus }, { onConflict: 'household_id,user_id,month_id' }),
        () => set({ state: prevState })
      );
    }
  }

}));

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
    if (bill.startMonth && bill.startMonth > monthId) return;

    const amount = amounts[bill.id] !== undefined ? amounts[bill.id] : bill.defaultAmount;
    const billAccount = state.accounts.find(a => a.id === bill.accountId);
    
    let liabilities: Record<string, number> = {};
    if (bill.splitType === 'equal') {
      const splitAmt = personAccounts.length > 0 ? amount / personAccounts.length : 0;
      personAccounts.forEach(p => { liabilities[p.id] = splitAmt; });
    } else {
      liabilities[bill.splitType] = amount;
    }

    if (billAccount?.type === 'shared') {
      Object.keys(liabilities).forEach(personId => {
        if (transfersToShared[personId] !== undefined && transfersToShared[personId][billAccount.id] !== undefined) {
          transfersToShared[personId][billAccount.id] += liabilities[personId];
        }
      });

      if (bill.isAutoTransfer === 'all') {
        Object.keys(liabilities).forEach(personId => {
          if (transfersToShared[personId] !== undefined && transfersToShared[personId][billAccount.id] !== undefined) {
            transfersToShared[personId][billAccount.id] -= liabilities[personId];
          }
        });
      } else if (bill.isAutoTransfer && bill.isAutoTransfer !== '') {
        const payerId = bill.isAutoTransfer;
        if (transfersToShared[payerId] !== undefined && transfersToShared[payerId][billAccount.id] !== undefined) {
          transfersToShared[payerId][billAccount.id] -= amount;
        }
      }
    } else if (billAccount?.type === 'person') {
      if (balances[billAccount.id] !== undefined) balances[billAccount.id] += amount;
      Object.keys(liabilities).forEach(personId => {
        if (balances[personId] !== undefined) balances[personId] -= liabilities[personId];
      });
    }
  });

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
