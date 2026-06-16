import { parseBankData } from '../src/utils/bankParser';
import { HouseholdImportRule } from '../src/types';

const mockRules: HouseholdImportRule[] = [
  {
    id: '1',
    household_id: 'hh1',
    search_string: 'TELIA',
    target_account_id: 'acc_hus',
    is_bill: true,
    rule_type: 'SYSTEM',
    usage_count: 5,
    matched_examples: [],
    last_seen_at: new Date().toISOString()
  },
  {
    id: '2',
    household_id: 'hh1',
    search_string: 'ICA SUPERMARKET',
    target_account_id: 'acc_mat',
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

const mockExcelData = [
  ['Datum', 'Beskrivning', 'Belopp'],
  ['2023-01-01', 'TELIA SVERIGE AB', -499],
  ['2023-01-02', 'ICA SUPERMARKET CENTRUM', -250],
  ['2023-01-03', 'OKÄND MOTTAGARE AB', -150],
  ['2023-01-04', 'SWISH ANDREAS', 500] // Inkomst / överföring
];

function runTest() {
  const result = parseBankData(mockExcelData, mockRules, mockAccounts);
  console.log("=== BANK PARSER TEST RESULTS ===");
  console.log("Summary:", result.summary);
  console.log("\nSuggested Bills:", result.suggestedBills.map(b => ({
    name: b.rawDescription,
    normalized: b.normalizedDescription,
    confidence: b.confidenceScore,
    suggestedAccount: mockAccounts.find(a => a.id === b.suggestedAccountId)?.name
  })));
  console.log("\nOther Transactions:", result.otherTransactions.map(b => ({
    name: b.rawDescription,
    normalized: b.normalizedDescription,
    amount: b.amount,
    isRecognized: b.isRecognized
  })));
}

runTest();
