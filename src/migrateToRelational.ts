import { supabase } from './supabase';
import type { AppState } from './types';

export async function runRelationalMigration(householdId: string, userId: string) {
  try {
    // 1. Läs gammal state
    const { data: household, error: fetchErr } = await supabase
      .from('households')
      .select('state_json')
      .eq('id', householdId)
      .single();

    if (fetchErr || !household || !household.state_json) return;

    const state = household.state_json as AppState;
    const idMap = new Map<string, string>();

    const getUuid = (oldId: string): string => {
      if (!oldId) return crypto.randomUUID();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(oldId)) {
        return oldId;
      }
      if (!idMap.has(oldId)) {
        idMap.set(oldId, crypto.randomUUID());
      }
      return idMap.get(oldId)!;
    };

    // 2. Mappa och infoga Konton
    if (state.accounts && state.accounts.length > 0) {
      const accountsToInsert = state.accounts.map(a => ({
        id: getUuid(a.id),
        household_id: householdId,
        name: a.name,
        type: a.type,
        transfer_method: a.transferMethod || null
      }));
      const { error } = await supabase.from('accounts').upsert(accountsToInsert, { onConflict: 'id' });
      if (error) console.error("Accounts migration error:", error);
    }

    // 3. Mappa och infoga Gemensamma Räkningar
    if (state.bills && state.bills.length > 0) {
      const billsToInsert = state.bills.map(b => ({
        id: getUuid(b.id),
        household_id: householdId,
        name: b.name,
        account_id: getUuid(b.accountId),
        split_type: b.splitType,
        default_amount: b.defaultAmount || 0,
        interval: b.interval || 'all',
        custom_months: b.customMonths || [],
        warn_if_zero: b.warnIfZero || false,
        is_loan: b.isLoan || false,
        total_debt: b.totalDebt || null
      }));
      const { error } = await supabase.from('bills').upsert(billsToInsert, { onConflict: 'id' });
      if (error) console.error("Bills migration error:", error);
    }

    // 4. Mappa Månadsdata (Gemensam)
    if (state.months) {
      for (const [monthId, mData] of Object.entries(state.months)) {
        if (mData.billAmounts) {
          const amounts = Object.entries(mData.billAmounts).map(([billId, amt]) => ({
            household_id: householdId,
            month_id: monthId,
            bill_id: getUuid(billId),
            amount: amt
          }));
          if (amounts.length > 0) {
            const { error } = await supabase.from('month_bill_amounts').upsert(amounts, { onConflict: 'household_id,month_id,bill_id' });
            if (error) console.error("month_bill_amounts error:", error);
          }
        }
        if (mData.handledPayments) {
          const payments = Object.entries(mData.handledPayments).map(([paymentId, handled]) => ({
            household_id: householdId,
            month_id: monthId,
            payment_id: getUuid(paymentId),
            is_handled: handled
          }));
          if (payments.length > 0) {
            const { error } = await supabase.from('month_handled_payments').upsert(payments, { onConflict: 'household_id,month_id,payment_id' });
            if (error) console.error("month_handled_payments error:", error);
          }
        }
        if (mData.confirmedAnomalies) {
          const anoms = Object.entries(mData.confirmedAnomalies).map(([billId, conf]) => ({
            household_id: householdId,
            month_id: monthId,
            bill_id: getUuid(billId),
            is_confirmed: conf
          }));
          if (anoms.length > 0) {
            const { error } = await supabase.from('month_confirmed_anomalies').upsert(anoms, { onConflict: 'household_id,month_id,bill_id' });
            if (error) console.error("month_confirmed_anomalies error:", error);
          }
        }
      }
    }

    // 5. Privata Räkningar
    if (state.privateBills && state.privateBills.length > 0) {
      const pBills = state.privateBills.map(b => ({
        id: getUuid(b.id),
        household_id: householdId,
        user_id: b.userId,
        name: b.name,
        default_amount: b.defaultAmount || 0,
        interval: b.interval || 'all',
        custom_months: b.customMonths || [],
        warn_if_zero: b.warnIfZero || false,
        is_shared: b.isShared || false,
        is_loan: b.isLoan || false,
        total_debt: b.totalDebt || null
      }));
      const { error } = await supabase.from('private_bills').upsert(pBills, { onConflict: 'id' });
      if (error) console.error("Private bills error:", error);
    }

    // 6. Privat Månadsdata
    if (state.privateMonths) {
      for (const [monthId, mData] of Object.entries(state.privateMonths)) {
        if (mData.billAmounts) {
          const amounts = Object.entries(mData.billAmounts).map(([billId, amt]) => ({
            household_id: householdId,
            user_id: userId,
            month_id: monthId,
            bill_id: getUuid(billId),
            amount: amt
          }));
          if (amounts.length > 0) {
            const { error } = await supabase.from('private_month_amounts').upsert(amounts, { onConflict: 'household_id,user_id,month_id,bill_id' });
            if (error) console.error("private_month_amounts error:", error);
          }
        }
        if (mData.isLocked) {
          await supabase.from('private_month_locks').upsert({
            household_id: householdId,
            user_id: userId,
            month_id: monthId,
            is_locked: mData.isLocked
          }, { onConflict: 'household_id,user_id,month_id' });
        }
        if (mData.confirmedAnomalies) {
          const anoms = Object.entries(mData.confirmedAnomalies).map(([billId, conf]) => ({
            household_id: householdId,
            user_id: userId,
            month_id: monthId,
            bill_id: getUuid(billId),
            is_confirmed: conf
          }));
          if (anoms.length > 0) {
            const { error } = await supabase.from('private_month_anomalies').upsert(anoms, { onConflict: 'household_id,user_id,month_id,bill_id' });
            if (error) console.error("private_month_anomalies error:", error);
          }
        }
      }
    }

    // 7. Inställningar
    if (state.settings) {
      await supabase.from('household_settings').upsert({
        household_id: householdId,
        show_summary: state.settings.showSummary !== false
      }, { onConflict: 'household_id' });
    }

    console.log("Migration till relationsdatabas genomförd!");

  } catch (err) {
    console.error("Migration misslyckades", err);
  }
}
