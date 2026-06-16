import type { HouseholdImportRule } from '../types';

export interface ParsedBankRow {
  originalIndex: number;
  date: string;
  rawDescription: string;
  normalizedDescription: string;
  amount: number;
  confidenceScore: number;
  suggestedAccountId: string | null;
  isSuggestedBill: boolean;
  isRecognized: boolean; // True if it matches any rule (even if is_bill is false)
  selectedAccountId: string | null; // For the UI dropdown
  selectedAsBill: boolean; // For the UI checkbox
}

export interface BankParseResult {
  suggestedBills: ParsedBankRow[];
  otherTransactions: ParsedBankRow[];
  summary: {
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
  
  // Clean up extra spaces and non-alphanumeric chars (optional, but spaces for sure)
  s = s.replace(/[^A-Z0-9ÅÄÖ ]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  
  return s;
}

export function parseBankData(
  jsonData: any[][], 
  rules: HouseholdImportRule[],
  householdAccounts: { id: string, name: string }[]
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
      if (cell.includes('belopp') || cell.includes('summa') || cell.includes('kredit')) amountIdx = j;
    }
    
    if (dateIdx !== -1 && descIdx !== -1 && amountIdx !== -1) {
      headerRowIdx = i;
      break;
    }
  }

  // Fallback if headers not found explicitly: guess based on data types
  if (headerRowIdx === -1) {
    // We could do heuristic guessing here, but for now we require headers.
    // Assuming simple fallback: 0: Date, 1: Text, 2: Amount
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
    
    // Clean amount
    let amount = 0;
    if (typeof rawAmount === 'number') {
      amount = Math.abs(rawAmount); // We want positive numbers for bills
    } else if (typeof rawAmount === 'string') {
      const parsed = parseFloat(rawAmount.replace(/[^0-9,-]+/g, '').replace(',', '.'));
      if (!isNaN(parsed)) amount = Math.abs(parsed);
    }

    if (amount === 0) continue; // Skip zero transactions

    const normalized = normalizeBankString(String(rawDesc));
    
    // Find matching rule
    let matchedRule: HouseholdImportRule | null = null;
    let highestConfidence = 0;

    for (const rule of rules) {
      if (normalized.includes(rule.search_string) || rule.search_string.includes(normalized)) {
        // Calculate dynamic confidence
        // Simple confidence: length ratio
        const lenRatio = Math.min(normalized.length, rule.search_string.length) / Math.max(normalized.length, rule.search_string.length);
        let confidence = Math.round(lenRatio * 100);
        
        // Boost confidence if it's been used a lot
        confidence = Math.min(99, confidence + (rule.usage_count * 2));
        
        // Exact match gets 100%
        if (normalized === rule.search_string) confidence = 100;

        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          matchedRule = rule;
        }
      }
    }

    // Determine target account
    let suggestedAccount = matchedRule?.target_account_id || null;
    if (!suggestedAccount) {
      // Fallback: Check if description contains any account name (e.g. "Andreas")
      for (const acc of householdAccounts) {
        if (normalized.includes(acc.name.toUpperCase())) {
          suggestedAccount = acc.id;
          highestConfidence = Math.max(highestConfidence, 60); // Guessed from name
          break;
        }
      }
    }

    // If no account guessed, default to the first shared account
    if (!suggestedAccount) {
        const sharedAcc = householdAccounts.find(() => true); // In ManageBills we pass shared accounts first
        suggestedAccount = sharedAcc ? sharedAcc.id : null;
    }

    const isRecognized = !!matchedRule;
    if (!isRecognized) {
      unknownCount++;
    }

    // Should it be a bill?
    // If it matches a rule that says is_bill = true, yes.
    // If it matches no rule, we default to false (it goes to "Other")
    const isSuggestedBill = matchedRule ? matchedRule.is_bill : false;

    if (isSuggestedBill && isRecognized) {
      recognizedSuggestedCount++;
    }

    parsedRows.push({
      originalIndex: i,
      date: String(rawDate),
      rawDescription: String(rawDesc).trim(),
      normalizedDescription: normalized,
      amount,
      confidenceScore: highestConfidence,
      suggestedAccountId: suggestedAccount,
      isSuggestedBill,
      isRecognized,
      selectedAccountId: suggestedAccount,
      selectedAsBill: isSuggestedBill
    });
  }

  // Sort and split
  const suggestedBills = parsedRows
    .filter(r => r.isSuggestedBill)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
    
  const otherTransactions = parsedRows
    .filter(r => !r.isSuggestedBill)
    .sort((a, b) => b.amount - a.amount); // Sort by largest amount for others

  return {
    suggestedBills,
    otherTransactions,
    summary: {
      suggestedCount: suggestedBills.length,
      recognizedSuggestedCount,
      otherCount: otherTransactions.length,
      unknownCount
    }
  };
}
