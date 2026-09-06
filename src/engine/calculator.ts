import type { AppState, CalculationResult, SwishTransfer } from '../types';

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

  // Calculate incomes for this month
  const personIncomes: Record<string, number> = {};
  let totalHouseholdIncome = 0;

  personAccounts.forEach(p => {
    let incomeSum = 0;
    const userIncomes = state.incomes?.filter(i => i.userId === p.id) || [];
    
    userIncomes.forEach(inc => {
      if (inc.type === 'fixed') {
        incomeSum += inc.amount;
      } else if (inc.type === 'variable' && inc.payDate) {
        const d = new Date(inc.payDate);
        const nextMonthDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
        if (nextMonthStr === monthId) {
          incomeSum += inc.amount;
        }
      }
    });

    personIncomes[p.id] = incomeSum;
    totalHouseholdIncome += incomeSum;
  });

  state.bills.forEach(bill => {
    if (bill.startMonth && bill.startMonth > monthId) return;

    const amount = amounts[bill.id] !== undefined ? amounts[bill.id] : bill.defaultAmount;
    const billAccount = state.accounts.find(a => a.id === bill.accountId);
    
    const liabilities: Record<string, number> = {};
    if (bill.splitType === 'equal') {
      const splitAmt = personAccounts.length > 0 ? amount / personAccounts.length : 0;
      personAccounts.forEach(p => { liabilities[p.id] = splitAmt; });
    } else if (bill.splitType === 'proportional') {
      if (totalHouseholdIncome <= 0 || personAccounts.length === 0) {
        const splitAmt = personAccounts.length > 0 ? amount / personAccounts.length : 0;
        personAccounts.forEach(p => { liabilities[p.id] = splitAmt; });
      } else {
        let remainingAmount = amount;
        for (let i = 0; i < personAccounts.length; i++) {
          const p = personAccounts[i];
          if (i === personAccounts.length - 1) {
            liabilities[p.id] = Math.max(0, remainingAmount);
          } else {
            const shareRatio = personIncomes[p.id] / totalHouseholdIncome;
            const personShare = Math.round((amount * shareRatio) * 100) / 100;
            liabilities[p.id] = personShare;
            remainingAmount -= personShare;
          }
        }
      }
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
