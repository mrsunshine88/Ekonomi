import * as XLSX from 'xlsx';
import type { AppState } from './types';
import { calculateMonth } from './store';

export const exportToExcel = (state: AppState) => {
  const sortedMonths = Object.keys(state.months).sort();
  
  // -- BLAD 1: RÄKNINGAR --
  const headerRow = ["Räkning", "Konto", ...sortedMonths];
  const billRows = state.bills.map(bill => {
    const account = state.accounts.find(a => a.id === bill.accountId)?.name || 'Okänt konto';
    const row: any[] = [bill.name, account];
    
    sortedMonths.forEach(monthId => {
      const monthData = state.months[monthId];
      const amount = monthData?.billAmounts[bill.id] !== undefined ? monthData.billAmounts[bill.id] : bill.defaultAmount;
      row.push(amount);
    });
    return row;
  });

  // Calculate totals per month
  const totalRow = ["TOTALT", "Alla konton"];
  sortedMonths.forEach(monthId => {
    const monthData = state.months[monthId];
    let total = 0;
    state.bills.forEach(bill => {
      const amount = monthData?.billAmounts[bill.id] !== undefined ? monthData.billAmounts[bill.id] : bill.defaultAmount;
      total += amount;
    });
    totalRow.push(total);
  });

  const ws1 = XLSX.utils.aoa_to_sheet([headerRow, ...billRows, [], totalRow]);

  // Make columns wider
  ws1['!cols'] = [
    { wch: 20 }, // Räkning
    { wch: 15 }, // Konto
    ...sortedMonths.map(() => ({ wch: 10 })) // Månaderna
  ];

  // -- BLAD 2: SWISH & ÖVERFÖRINGAR --
  const transferHeaders = ["Månad", "Från", "Till", "Belopp (kr)"];
  const transferRows: any[][] = [];

  sortedMonths.forEach(monthId => {
    const result = calculateMonth(state, monthId);
    
    // Gemensamma konton överföringar
    Object.keys(result.transfersToShared).forEach(personId => {
      Object.keys(result.transfersToShared[personId]).forEach(sharedId => {
        const amt = result.transfersToShared[personId][sharedId];
        if (amt > 0) {
          const personName = state.accounts.find(a => a.id === personId)?.name || personId;
          const sharedName = state.accounts.find(a => a.id === sharedId)?.name || sharedId;
          transferRows.push([monthId, personName, sharedName, Math.round(amt)]);
        }
      });
    });

    // Swishes
    result.swishes.forEach(swish => {
      const fromName = state.accounts.find(a => a.id === swish.fromId)?.name || swish.fromId;
      const toName = state.accounts.find(a => a.id === swish.toId)?.name || swish.toId;
      transferRows.push([monthId, fromName, toName, Math.round(swish.amount)]);
    });
  });

  const ws2 = XLSX.utils.aoa_to_sheet([transferHeaders, ...transferRows]);
  ws2['!cols'] = [
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 }
  ];

  // Build workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Räkningar (Per Månad)");
  XLSX.utils.book_append_sheet(wb, ws2, "Överföringar & Swish");

  // Download
  XLSX.writeFile(wb, "EkonomiTB_Sammanstallning.xlsx");
};
