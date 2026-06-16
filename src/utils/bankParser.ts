import type { HouseholdImportRule } from '../types';

export interface ParsedBankRow {
  originalIndex: number;
  date: string;
  rawDescription: string;
  normalizedDescription: string;
  amount: number;
  isIncoming: boolean;
  confidenceScore: number;
  
  // New UI mapping
  matchLevel: 'confirmed' | 'new_discovery' | 'needs_review' | 'no_match' | 'already_imported';
  matchedVia: string;
  aliasMatched?: string;
  historicalMin?: number;
  historicalMax?: number;
  isAmountNormal?: boolean;
  
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
    ' KORTTRANSAKTION', ' ÖVERFÖRING', ' SWISH', ' BETALNING', ' KONTO', ' INC', ' LLC', '.COM'
  ];
  
  for (const noise of noiseWords) {
    s = s.replace(new RegExp(noise, 'g'), ' ');
  }
  
  // Clean up extra spaces and non-alphanumeric chars
  s = s.replace(/[^A-Z0-9ÅÄÖ ]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  
  return s;
}

const SYSTEM_CATEGORIES: Record<string, string[]> = {
  SUBSCRIPTIONS: ["NETFLIX", "HBO MAX", "DISNEY", "VIAPLAY", "STORYTEL", "BOOKBEAT", "SPOTIFY"],
  INSURANCE: ["FOLKSAM", "IF", "LÄNSFÖRSÄKRINGAR", "HEDVIG"],
  LOANS: ["CSN", "SBAB", "SANTANDER"],
  UTILITIES: ["FORTUM", "EON", "VATTENFALL", "SKELLEFTEÅ KRAFT", "MÄLARENERGI", "GÖTEBORG ENERGI", "ÖRESUNDSKRAFT"],
  UNIONS: ["UNIONEN", "KOMMUNAL", "IF METALL", "AKAVIA", "VISION", "ST"],
  TRANSPORT: ["TRANSPORTSTYRELSEN", "EASYPARK", "PARKSTER", "CARPAY", "VOLVO FINANS"],
  FINANCE: ["KLARNA", "RESURS", "SVEA BANK", "IKANO", "COLLECTOR", "ANYFIN"],
  TELECOM: ["TELIA", "TELE2", "TRE", "HALLON", "VIMLA", "BAHNHOF"],
  SERVICES: ["GOOGLE ONE", "AMAZON", "AUDIBLE"]
};

const SYSTEM_ALIASES: Record<string, string> = {
  "NETFLIX.COM": "NETFLIX",
  "NETFLIX*": "NETFLIX",
  "HBOMAX": "HBO MAX",
  "GOOGLE": "GOOGLE ONE",
  "GOOGLEONE": "GOOGLE ONE",
  "LF FINANS": "LÄNSFÖRSÄKRINGAR",
  "LF HYPOTEK": "LÄNSFÖRSÄKRINGAR"
};

const SYSTEM_BILLS_ALL = Object.values(SYSTEM_CATEGORIES).flat();

export function parseBankData(
  jsonData: any[][], 
  rules: HouseholdImportRule[],
  householdAccounts: { id: string, name: string }[],
  householdProfiles: { id: string, display_name?: string, email?: string }[] = [],
  knownBills: { accountId: string, defaultAmount: number, name: string }[] = [],
  knownIncomes: { userId: string, amount: number, name: string, payDate?: string }[] = []
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
    const trimmedDesc = String(rawDesc).trim();
    const dateStr = String(rawDate).trim();
    
    // Check if already imported
    const alreadyBill = !isIncoming && knownBills.some(b => b.name === trimmedDesc);
    const alreadyIncome = isIncoming && knownIncomes.some(i => i.name === trimmedDesc && i.payDate === dateStr && i.amount === amount);
    const isAlreadyImported = alreadyBill || alreadyIncome;
    
    let matchLevel: ParsedBankRow['matchLevel'] = isAlreadyImported ? 'already_imported' : 'no_match';
    let matchedVia = isAlreadyImported ? 'Finns redan i appen' : 'Ingen regel hittades';
    let aliasMatched: string | undefined;
    let isRecognized = isAlreadyImported;
    let suggestedAccount = null;
    let suggestedUser = null;
    let isSuggestedBill = false;
    let isSuggestedIncome = false;
    let highestConfidence = 0;

    // Check Alias
    let searchString = normalized;
    const tokens = normalized.split(' ');
    for (const [alias, realName] of Object.entries(SYSTEM_ALIASES)) {
      if (tokens.includes(alias) || searchString.includes(alias)) {
         searchString = realName;
         aliasMatched = `${alias} → ${realName}`;
         break;
      }
    }

    // 1. Hushållets minne
    let matchedRule: HouseholdImportRule | null = null;
    if (!isAlreadyImported) {
      for (const rule of rules) {
        if (searchString.includes(rule.search_string) || rule.search_string.includes(searchString)) {
          if ((rule.is_bill && isIncoming) || (!rule.is_bill && !isIncoming)) {
              continue; // Direction mismatch
          }
          
          // Find best match if multiple
          const confidence = rule.usage_count; // Simplified heuristic
          if (confidence >= highestConfidence) {
              highestConfidence = confidence;
              matchedRule = rule;
          }
        }
      }
    }

    if (matchedRule) {
      matchLevel = 'confirmed';
      matchedVia = `Tidigare import (${matchedRule.usage_count} gånger)`;
      isRecognized = true;
      if (matchedRule.is_bill && matchedRule.rule_target_type === 'ACCOUNT') {
        isSuggestedBill = true;
        suggestedAccount = matchedRule.target_id;
      } else if (!matchedRule.is_bill && matchedRule.rule_target_type === 'USER') {
        isSuggestedIncome = true;
        suggestedUser = matchedRule.target_id;
      }
    } else {
      // 2. SYSTEM_BILLS
      if (!isAlreadyImported) {
        if (!isIncoming) {
          const sysMatch = SYSTEM_BILLS_ALL.find(sb => searchString === sb || tokens.includes(sb));
          if (sysMatch) {
            matchLevel = 'new_discovery';
            matchedVia = `SYSTEM-regel ${sysMatch}`;
            isSuggestedBill = true;
            isRecognized = true;
          }
        }

        // 3. Textmönster
        if (matchLevel === 'no_match') {
          if (isIncoming) {
            if (searchString.includes('LÖN') || searchString.includes('SALARY') || searchString.includes('LON') || searchString.includes('UTBETALNING') || searchString.includes('BARNBDR')) {
              isSuggestedIncome = true;
              matchLevel = 'needs_review';
              matchedVia = 'Textanalys (Lön/Utbetalning/Bidrag)';
            }
          } else {
            for (const acc of householdAccounts) {
              if (searchString.includes(acc.name.toUpperCase())) {
                suggestedAccount = acc.id;
                isSuggestedBill = true;
                matchLevel = 'needs_review';
                matchedVia = `Textanalys (Kontonamn: ${acc.name})`;
                break;
              }
            }
            if (searchString.includes('AUTOGIRO')) {
               isSuggestedBill = true;
               matchLevel = 'needs_review';
               matchedVia = 'Textanalys (Autogiro)';
            }
          }
        }
      }
    }

    // Default target logic if none found (fallback selection)
    if (!isIncoming && !suggestedAccount && isSuggestedBill) {
      const sharedAcc = householdAccounts.find(() => true);
      suggestedAccount = sharedAcc ? sharedAcc.id : null;
    }
    if (isIncoming && !suggestedUser && isSuggestedIncome) {
      const firstUser = householdProfiles.find(() => true);
      suggestedUser = firstUser ? firstUser.id : null;
    }

    if (!isRecognized && matchLevel === 'no_match') {
      unknownCount++;
    }

    if (isRecognized && (isSuggestedBill || isSuggestedIncome)) {
      recognizedSuggestedCount++;
    }

    // Amount validation
    let historicalMin: number | undefined;
    let historicalMax: number | undefined;
    let isAmountNormal = true;

    if (matchLevel === 'confirmed') {
      if (isSuggestedBill && suggestedAccount) {
        // Find expected amount
        const matchingBills = knownBills.filter(b => b.accountId === suggestedAccount);
        if (matchingBills.length > 0) {
           const avg = matchingBills.reduce((sum, b) => sum + b.defaultAmount, 0) / matchingBills.length;
           if (avg > 0) {
              historicalMin = Math.round(avg * 0.85);
              historicalMax = Math.round(avg * 1.15);
              if (amount < historicalMin || amount > historicalMax) {
                 isAmountNormal = false;
              }
           }
        }
      } else if (isSuggestedIncome && suggestedUser) {
        const matchingIncomes = knownIncomes.filter(i => i.userId === suggestedUser);
        if (matchingIncomes.length > 0) {
           const avg = matchingIncomes.reduce((sum, i) => sum + i.amount, 0) / matchingIncomes.length;
           if (avg > 0) {
              historicalMin = Math.round(avg * 0.85);
              historicalMax = Math.round(avg * 1.15);
              if (amount < historicalMin || amount > historicalMax) {
                 isAmountNormal = false;
              }
           }
        }
      }
    }

    parsedRows.push({
      originalIndex: i,
      date: String(rawDate).trim(),
      rawDescription: String(rawDesc).trim(),
      normalizedDescription: searchString,
      amount,
      isIncoming,
      confidenceScore: highestConfidence,
      
      matchLevel,
      matchedVia,
      aliasMatched,
      historicalMin,
      historicalMax,
      isAmountNormal,
      
      suggestedAccountId: suggestedAccount,
      selectedAccountId: suggestedAccount,
      isSuggestedBill: isSuggestedBill || alreadyBill,
      selectedAsBill: isSuggestedBill && (matchLevel === 'confirmed' || matchLevel === 'new_discovery'),
      
      suggestedUserId: suggestedUser,
      selectedUserId: suggestedUser,
      isSuggestedIncome: isSuggestedIncome || alreadyIncome,
      selectedAsIncome: isSuggestedIncome && (matchLevel === 'confirmed' || matchLevel === 'new_discovery'),
      
      isRecognized
    });
  }

  // Sort and split
  const suggestedIncomes = parsedRows
    .filter(r => r.isSuggestedIncome)
    .sort((a, b) => {
       const order = { 'confirmed': 0, 'new_discovery': 1, 'needs_review': 2, 'no_match': 3, 'already_imported': 4 };
       return order[a.matchLevel] - order[b.matchLevel];
    });

  const suggestedBills = parsedRows
    .filter(r => r.isSuggestedBill)
    .sort((a, b) => {
       const order = { 'confirmed': 0, 'new_discovery': 1, 'needs_review': 2, 'no_match': 3, 'already_imported': 4 };
       return order[a.matchLevel] - order[b.matchLevel];
    });
    
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
