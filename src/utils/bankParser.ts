import type { HouseholdImportRule } from '../types';

export interface ParsedBankRow {
  originalIndex: number;
  date: string;
  rawDescription: string;
  normalizedDescription: string;
  amount: number;
  isIncoming: boolean;
  confidenceScore: number;
  
  // Bill targets
  suggestedAccountId: string | null;
  selectedAccountId: string | null;
  isSuggestedBill: boolean;
  selectedAsBill: boolean;
  
  // Income targets
  suggestedUserId: string | null;
  selectedUserId: string | null;
  isSuggestedIncome: boolean;
  selectedAsIncome: boolean;

  isRecognized: boolean; // True if it matches any rule
}

export interface BankParseResult {
  suggestedIncomes: ParsedBankRow[];
  suggestedBills: ParsedBankRow[];
  otherTransactions: ParsedBankRow[];
  summary: {
    suggestedIncomesCount: number;
    suggestedCount: number;
    recognizedSuggestedCount: number;
    otherCount: number;
    unknownCount: number;
  };
}

// Helper: Normalize strings for better matching
export function normalizeBankString(str: string): string {
  if (!str) return '';
  let s = str.toUpperCase().trim();
  
  // Remove common bank/company noise words
  const noiseWords = [
    ' AB', ' AKTIEBOLAG', ' SVERIGE', ' AUTOGIRO', ' BG', ' PG', ' KORTKÖP', 
    ' KORTTRANSAKTION', ' ÖVERFÖRING', ' SWISH', ' BETALNING', ' KONTO', ' INC', ' LLC'
  ];
  
  for (const noise of noiseWords) {
    s = s.replace(new RegExp(noise, 'g'), ' ');
  }
  
  // Clean up extra spaces and non-alphanumeric chars
  s = s.replace(/[^A-Z0-9ÅÄÖ ]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  
  return s;
}

export function parseBankData(
  jsonData: any[][], 
  rules: HouseholdImportRule[],
  householdAccounts: { id: string, name: string }[],
  householdProfiles: { id: string, display_name?: string, email?: string }[] = []
): BankParseResult {
  
  // 1. Detect Columns
  let dateIdx = -1;
  let descIdx = -1;
  let amountIdx = -1;
  let headerRowIdx = -1;

  for (let i = 0; i < Math.min(20, jsonData.length); i++) {
    const row = jsonData[i];
    if (!row) continue;
    
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toLowerCase();
      if (cell.includes('datum')) dateIdx = j;
      if (cell.includes('beskrivning') || cell.includes('text') || cell.includes('mottagare') || cell.includes('transaktion')) descIdx = j;
      if (cell.includes('belopp') || cell.includes('summa') || cell.includes('kredit') || cell.includes('insättning') || cell.includes('uttag') || cell.includes('amount')) amountIdx = j;
    }
    
    if (dateIdx !== -1 && descIdx !== -1 && amountIdx !== -1) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    dateIdx = 0; descIdx = 1; amountIdx = 2; headerRowIdx = 0;
  }

  const parsedRows: ParsedBankRow[] = [];
  let unknownCount = 0;
  let recognizedSuggestedCount = 0;

  for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;

    const rawDate = row[dateIdx];
    const rawDesc = row[descIdx];
    let rawAmount = row[amountIdx];

    if (!rawDesc || (!rawAmount && rawAmount !== 0)) continue;
    
    // Clean amount & determine direction
    let rawAmountNum = 0;
    if (typeof rawAmount === 'number') {
      rawAmountNum = rawAmount;
    } else if (typeof rawAmount === 'string') {
      const sign = rawAmount.includes('-') ? -1 : 1;
      const parsed = parseFloat(rawAmount.replace(/[^0-9,]+/g, '').replace(',', '.'));
      if (!isNaN(parsed)) rawAmountNum = parsed * sign;
    }

    if (rawAmountNum === 0 || isNaN(rawAmountNum)) continue;
    
    const isIncoming = rawAmountNum > 0;
    const amount = Math.abs(rawAmountNum);
    const normalized = normalizeBankString(String(rawDesc));
    
    // Find matching rule
    let matchedRule: HouseholdImportRule | null = null;
    let highestConfidence = 0;

    for (const rule of rules) {
      if (normalized.includes(rule.search_string) || rule.search_string.includes(normalized)) {
        // Fastighetsmäklare-regel: Kolla även riktningen. En inkomst kan inte trigga en "is_bill=true"-regel
        if ((rule.is_bill && isIncoming) || (!rule.is_bill && !isIncoming)) {
            continue; // Mismatch mellan inkomst/utgift och regeln
        }

        const lenRatio = Math.min(normalized.length, rule.search_string.length) / Math.max(normalized.length, rule.search_string.length);
        let confidence = Math.round(lenRatio * 100);
        
        confidence = Math.min(99, confidence + (rule.usage_count * 2));
        if (normalized === rule.search_string) confidence = 100;

        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          matchedRule = rule;
        }
      }
    }

    let suggestedAccount = null;
    let suggestedUser = null;
    let isSuggestedBill = false;
    let isSuggestedIncome = false;

    if (matchedRule) {
      if (matchedRule.is_bill && matchedRule.rule_target_type === 'ACCOUNT') {
        isSuggestedBill = true;
        suggestedAccount = matchedRule.target_id;
      } else if (!matchedRule.is_bill && matchedRule.rule_target_type === 'USER') {
        isSuggestedIncome = true;
        suggestedUser = matchedRule.target_id;
      }
    } else {
      // Fallbacks if no rule matched
      if (isIncoming) {
        if (normalized.includes('LÖN') || normalized.includes('SALARY') || normalized.includes('LON')) {
          isSuggestedIncome = true;
          highestConfidence = Math.max(highestConfidence, 70); // Basic heuristic guess
        }
      } else {
        // It's outgoing. Check if description matches any account name
        for (const acc of householdAccounts) {
          if (normalized.includes(acc.name.toUpperCase())) {
            suggestedAccount = acc.id;
            highestConfidence = Math.max(highestConfidence, 60);
            break;
          }
        }
      }
    }

    // Default target logic if none found
    if (!isIncoming && !suggestedAccount) {
      const sharedAcc = householdAccounts.find(() => true);
      suggestedAccount = sharedAcc ? sharedAcc.id : null;
    }
    if (isIncoming && !suggestedUser) {
      const firstUser = householdProfiles.find(() => true);
      suggestedUser = firstUser ? firstUser.id : null;
    }

    const isRecognized = !!matchedRule;
    if (!isRecognized) {
      unknownCount++;
    }

    if (isRecognized && (isSuggestedBill || isSuggestedIncome)) {
      recognizedSuggestedCount++;
    }

    parsedRows.push({
      originalIndex: i,
      date: String(rawDate).trim(),
      rawDescription: String(rawDesc).trim(),
      normalizedDescription: normalized,
      amount,
      isIncoming,
      confidenceScore: highestConfidence,
      
      suggestedAccountId: suggestedAccount,
      selectedAccountId: suggestedAccount,
      isSuggestedBill,
      selectedAsBill: isSuggestedBill,
      
      suggestedUserId: suggestedUser,
      selectedUserId: suggestedUser,
      isSuggestedIncome,
      selectedAsIncome: isSuggestedIncome,
      
      isRecognized
    });
  }

  // Sort and split
  const suggestedIncomes = parsedRows
    .filter(r => r.isSuggestedIncome)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const suggestedBills = parsedRows
    .filter(r => r.isSuggestedBill)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
    
  const otherTransactions = parsedRows
    .filter(r => !r.isSuggestedBill && !r.isSuggestedIncome)
    .sort((a, b) => b.amount - a.amount);

  return {
    suggestedIncomes,
    suggestedBills,
    otherTransactions,
    summary: {
      suggestedIncomesCount: suggestedIncomes.length,
      suggestedCount: suggestedBills.length,
      recognizedSuggestedCount,
      otherCount: otherTransactions.length,
      unknownCount
    }
  };
}
