import { parseBankData } from '../src/utils/bankParser';
import { HouseholdImportRule } from '../src/types';

const mockRules: HouseholdImportRule[] = [
  {
    id: '1',
    household_id: 'hh1',
    search_string: 'TELIA',
    target_id: 'acc_hus',
    rule_target_type: 'ACCOUNT',
    is_bill: true,
    rule_type: 'SYSTEM',
    usage_count: 5,
    matched_examples: [],
    last_seen_at: new Date().toISOString()
  },
  {
    id: '2',
    household_id: 'hh1',
    search_string: 'FORTNOX',
    target_id: 'user_andreas',
    rule_target_type: 'USER',
    is_bill: false,
    rule_type: 'USER',
    usage_count: 2,
    matched_examples: [],
    last_seen_at: new Date().toISOString()
  }
];

const mockAccounts = [
  { id: 'acc_hus', name: 'Hushållskonto' },
  { id: 'acc_mat', name: 'Matkonto' }
];

const mockProfiles = [
  { id: 'user_andreas', display_name: 'Andreas' },
  { id: 'user_helena', display_name: 'Helena' }
];

const mockExcelData = [
  ['Datum', 'Beskrivning', 'Belopp'],
  ['2023-01-01', 'TELIA SVERIGE AB', -499],
  ['2023-01-02', 'ICA SUPERMARKET CENTRUM', -250],
  ['2023-01-03', 'OKÄND MOTTAGARE AB', -150],
  ['2023-01-04', 'SWISH ANDREAS', 500], // Swish income
  ['2023-01-25', 'FORTNOX AB', 32400], // Salary according to rule
  ['2023-01-26', 'LÖNEUTBETALNING', 25000] // Salary via fallback
];

function runTest() {
  const result = parseBankData(mockExcelData, mockRules, mockAccounts, mockProfiles);
  console.log("=== BANK PARSER TEST RESULTS ===");
  console.log("Summary:", result.summary);
  
  console.log("\nSuggested INCOMES:", result.suggestedIncomes.map(b => ({
    name: b.rawDescription,
    normalized: b.normalizedDescription,
    confidence: b.confidenceScore,
    suggestedUser: mockProfiles.find(p => p.id === b.suggestedUserId)?.display_name,
    amount: b.amount
  })));

  console.log("\nSuggested Bills:", result.suggestedBills.map(b => ({
    name: b.rawDescription,
    normalized: b.normalizedDescription,
    confidence: b.confidenceScore,
    suggestedAccount: mockAccounts.find(a => a.id === b.suggestedAccountId)?.name,
    amount: b.amount
  })));

  console.log("\nOther Transactions:", result.otherTransactions.map(b => ({
    name: b.rawDescription,
    amount: (b.isIncoming ? '+' : '-') + b.amount,
    isRecognized: b.isRecognized
  })));
}

runTest();
