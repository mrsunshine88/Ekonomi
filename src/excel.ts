import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { AppState } from './types';
import { calculateMonth } from './store';

// Helper to style header row
const styleHeaderRow = (row: ExcelJS.Row) => {
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B0F19' } // Dark blue/black like app background
    };
    cell.font = {
      color: { argb: 'FFFFFFFF' },
      bold: true,
      size: 12
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF334155' } }
    };
  });
  row.height = 30;
};

// Helper to style total row
const styleTotalRow = (row: ExcelJS.Row) => {
  row.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' } // Light gray background for total
    };
    cell.border = {
      top: { style: 'double', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } }
    };
    if (colNumber > 2) {
      cell.numFmt = '#,##0 "kr"';
      cell.alignment = { horizontal: 'right' };
    }
  });
  row.height = 25;
};

// Helper for currency formatting on data rows
const formatCurrencyCells = (sheet: ExcelJS.Worksheet, startRow: number, endRow: number, startCol: number, endCol: number) => {
  for (let r = startRow; r <= endRow; r++) {
    const row = sheet.getRow(r);
    for (let c = startCol; c <= endCol; c++) {
      const cell = row.getCell(c);
      if (typeof cell.value === 'number') {
        cell.numFmt = '#,##0 "kr"';
        cell.alignment = { horizontal: 'right' };
      }
    }
  }
};

export const exportToExcel = async (state: AppState, userId?: string) => {
  const sortedMonths = Object.keys(state.months).sort();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SmartEkonomi';
  wb.created = new Date();

  // -- BLAD 1: GEMENSAMMA RÄKNINGAR --
  const ws1 = wb.addWorksheet('Gemensamma Räkningar', {
    views: [{ state: 'frozen', ySplit: 1 }] // Freeze header row
  });

  const header1 = ["Räkning", "Konto", ...sortedMonths];
  const headerRow1 = ws1.addRow(header1);
  styleHeaderRow(headerRow1);

  let r1Count = 1; // header is row 1
  
  // Sort bills by account name so bills from the same account are grouped together
  const sortedBills = [...state.bills].sort((a, b) => {
    const accountA = state.accounts.find(acc => acc.id === a.accountId)?.name || 'Övrigt konto';
    const accountB = state.accounts.find(acc => acc.id === b.accountId)?.name || 'Övrigt konto';
    return accountA.localeCompare(accountB, 'sv');
  });

  sortedBills.forEach(bill => {
    const account = state.accounts.find(a => a.id === bill.accountId)?.name || 'Okänt konto';
    const rowData: (string | number)[] = [bill.name, account];
    
    sortedMonths.forEach(monthId => {
      const monthData = state.months[monthId];
      const amount = monthData?.billAmounts[bill.id] !== undefined ? monthData.billAmounts[bill.id] : bill.defaultAmount;
      rowData.push(amount);
    });
    
    const row = ws1.addRow(rowData);
    r1Count++;
    
    // Alternating row colors
    if (r1Count % 2 === 0) {
      row.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } });
    }
  });

  // Totals
  const totalRowData1: (string | number)[] = ["TOTALT", "Alla konton"];
  sortedMonths.forEach(monthId => {
    const monthData = state.months[monthId];
    let total = 0;
    state.bills.forEach(bill => {
      const amount = monthData?.billAmounts[bill.id] !== undefined ? monthData.billAmounts[bill.id] : bill.defaultAmount;
      total += amount;
    });
    totalRowData1.push(total);
  });
  
  // Empty row before total
  ws1.addRow([]);
  r1Count++;
  
  const totalRow1 = ws1.addRow(totalRowData1);
  styleTotalRow(totalRow1);
  r1Count++;

  // Formatting values
  if (r1Count > 3) {
    formatCurrencyCells(ws1, 2, r1Count - 2, 3, 2 + sortedMonths.length);
  }

  // Column widths
  ws1.columns = [
    { width: 25 }, // Räkning
    { width: 20 }, // Konto
    ...sortedMonths.map(() => ({ width: 15 }))
  ];
  ws1.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 2 + sortedMonths.length }
  };


  // -- BLAD 2: SWISH & ÖVERFÖRINGAR --
  const ws2 = wb.addWorksheet('Överföringar & Swish', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  const header2 = ["Månad", "Från", "Till", "Belopp"];
  const headerRow2 = ws2.addRow(header2);
  styleHeaderRow(headerRow2);

  let r2Count = 1;
  sortedMonths.forEach(monthId => {
    const result = calculateMonth(state, monthId);
    
    // Gemensamma konton överföringar
    Object.keys(result.transfersToShared).forEach(personId => {
      Object.keys(result.transfersToShared[personId]).forEach(sharedId => {
        const amt = result.transfersToShared[personId][sharedId];
        if (amt > 0) {
          const personName = state.accounts.find(a => a.id === personId)?.name || personId;
          const sharedName = state.accounts.find(a => a.id === sharedId)?.name || sharedId;
          const row = ws2.addRow([monthId, personName, sharedName, Math.round(amt)]);
          r2Count++;
          if (r2Count % 2 === 0) row.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } });
        }
      });
    });

    // Swishes
    result.swishes.forEach(swish => {
      const fromName = state.accounts.find(a => a.id === swish.fromId)?.name || swish.fromId;
      const toName = state.accounts.find(a => a.id === swish.toId)?.name || swish.toId;
      const row = ws2.addRow([monthId, fromName, toName, Math.round(swish.amount)]);
      r2Count++;
      if (r2Count % 2 === 0) row.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } });
    });
  });

  if (r2Count > 1) {
    formatCurrencyCells(ws2, 2, r2Count, 4, 4);
  }

  ws2.columns = [
    { width: 15 },
    { width: 20 },
    { width: 20 },
    { width: 15 }
  ];
  ws2.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 4 }
  };


  // -- BLAD 3: PRIVATA RÄKNINGAR --
  if (userId) {
    const privateMonths = Object.keys(state.privateMonths || {}).sort();
    if (privateMonths.length > 0) {
      const myPrivateBills = (state.privateBills || []).filter(b => b.userId === userId);
      if (myPrivateBills.length > 0) {
        const ws3 = wb.addWorksheet('Mina Privata Räkningar', {
          views: [{ state: 'frozen', ySplit: 1 }]
        });

        const header3 = ["Privat Räkning", ...privateMonths];
        const headerRow3 = ws3.addRow(header3);
        styleHeaderRow(headerRow3);

        let r3Count = 1;
        myPrivateBills.forEach(bill => {
          const rowData: (string | number)[] = [bill.name];
          privateMonths.forEach(monthId => {
            const mData = state.privateMonths![monthId];
            const amount = mData.billAmounts[bill.id] !== undefined ? mData.billAmounts[bill.id] : bill.defaultAmount;
            rowData.push(amount);
          });
          
          const row = ws3.addRow(rowData);
          r3Count++;
          if (r3Count % 2 === 0) row.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } });
        });

        // Totals
        const totalRowData3: (string | number)[] = ["TOTALT"];
        privateMonths.forEach(monthId => {
          const mData = state.privateMonths![monthId];
          let total = 0;
          myPrivateBills.forEach(bill => {
            const amount = mData.billAmounts[bill.id] !== undefined ? mData.billAmounts[bill.id] : bill.defaultAmount;
            total += amount;
          });
          totalRowData3.push(total);
        });

        ws3.addRow([]);
        r3Count++;
        
        const totalRow3 = ws3.addRow(totalRowData3);
        // Fix style for private totals since it has only 1 text column instead of 2
        totalRow3.eachCell((cell, colNumber) => {
          cell.font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
          cell.border = {
            top: { style: 'double', color: { argb: 'FF94A3B8' } },
            bottom: { style: 'thin', color: { argb: 'FF94A3B8' } }
          };
          if (colNumber > 1) {
            cell.numFmt = '#,##0 "kr"';
            cell.alignment = { horizontal: 'right' };
          }
        });
        r3Count++;

        if (r3Count > 3) {
          formatCurrencyCells(ws3, 2, r3Count - 2, 2, 1 + privateMonths.length);
        }

        ws3.columns = [
          { width: 25 },
          ...privateMonths.map(() => ({ width: 15 }))
        ];
        ws3.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: 1 + privateMonths.length }
        };
      }
    }

    // -- BLAD 4: MIN LÖN / KVAR ATT LEVA PÅ --
    const myProfile = state.householdProfiles?.find((p) => p.id === userId);
    const selectedAccountId = myProfile?.person_account_id;
    const selectedAccount = state.accounts.find((a) => a.id === selectedAccountId);

    if (selectedAccount) {
      const ws4 = wb.addWorksheet('Min Lön & Kvar', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });

      const header4 = ["Månad", "Lön / Swish In", "Totala Utgifter", "Kvar att leva på"];
      const headerRow4 = ws4.addRow(header4);
      styleHeaderRow(headerRow4);

      let r4Count = 1;

      sortedMonths.forEach(monthId => {
        let totalIncome = 0;
        if (state.incomes) {
          const [mYear, mMonth] = monthId.split('-').map(Number);
          let payYear = mYear;
          let payMonth = mMonth - 1;
          if (payMonth === 0) {
            payMonth = 12;
            payYear -= 1;
          }
          const payMonthStr = `${payYear}-${String(payMonth).padStart(2, '0')}`;
          
          state.incomes.forEach((inc) => {
            if (inc.userId !== userId) return;
            if (inc.type === 'fixed') {
              totalIncome += inc.amount;
            } else if (inc.type === 'variable' && inc.payDate?.startsWith(payMonthStr)) {
              totalIncome += inc.amount;
            }
          });
        }

        const sharedRes = calculateMonth(state, monthId);
        
        let incomingSwish = 0;
        let outgoingSwish = 0;
        sharedRes.swishes.forEach((t) => {
          if (t.toId === selectedAccountId) incomingSwish += t.amount;
          if (t.fromId === selectedAccountId) outgoingSwish += t.amount;
        });

        totalIncome += incomingSwish;

        let totalExpense = 0;

        if (state.privateMonths?.[monthId]) {
          const pm = state.privateMonths[monthId];
          const activePrivate = (state.privateBills || []).filter((b) => b.userId === userId && !b.isArchived);
          activePrivate.forEach((b) => {
            const amt = pm.billAmounts?.[b.id] !== undefined ? pm.billAmounts[b.id] : b.defaultAmount;
            totalExpense += amt;
          });
        }

        const m = state.months[monthId];
        if (m) {
          const activeShared = state.bills.filter((b) => !b.isArchived);
          activeShared.forEach((b) => {
            if (b.accountId === selectedAccountId) {
              const amt = m.billAmounts?.[b.id] !== undefined ? m.billAmounts[b.id] : b.defaultAmount;
              totalExpense += amt;
            }
          });
        }

        if (selectedAccountId && sharedRes.transfersToShared[selectedAccountId]) {
          Object.values(sharedRes.transfersToShared[selectedAccountId]).forEach((amt) => {
            if (amt > 0) totalExpense += amt;
          });
        }

        totalExpense += outgoingSwish;

        const leftover = totalIncome - totalExpense;

        const row = ws4.addRow([monthId, totalIncome, totalExpense, leftover]);
        r4Count++;
        if (r4Count % 2 === 0) row.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } });
      });

      if (r4Count > 1) {
        formatCurrencyCells(ws4, 2, r4Count, 2, 4);
      }

      ws4.columns = [
        { width: 15 },
        { width: 25 },
        { width: 25 },
        { width: 25 }
      ];
      ws4.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 4 }
      };
    }
  }

  // Generate blob and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, "Statistik_Sammanstallning.xlsx");
};
