import { describe, it, expect } from 'vitest';
import { parseBankData } from './bankParser';
import type { HouseholdImportRule } from '../types';

describe('bankParser', () => {
  it('should correctly identify incoming salaries based on text', () => {
    const rawData = [
      ['Datum', 'Beskrivning', 'Belopp', 'Saldo'],
      ['2026-06-25', 'LÖN', '25000,00', '35000,00'],
    ];

    const result = parseBankData(rawData, [], [], [], [], []);
    
    expect(result.suggestedIncomes.length).toBe(1);
    expect(result.suggestedIncomes[0].amount).toBe(25000);
    expect(result.suggestedIncomes[0].isIncoming).toBe(true);
    expect(result.suggestedIncomes[0].matchLevel).toBe('needs_review');
  });

  it('should correctly map SYSTEM_BILLS', () => {
    const rawData = [
      ['Datum', 'Beskrivning', 'Belopp', 'Saldo'],
      ['2026-06-20', 'NETFLIX.COM', '-109,00', '10000,00'],
    ];

    const result = parseBankData(rawData, [], [], [], [], []);
    
    expect(result.suggestedBills.length).toBe(1);
    expect(result.suggestedBills[0].amount).toBe(109);
    expect(result.suggestedBills[0].isIncoming).toBe(false);
    expect(result.suggestedBills[0].matchLevel).toBe('new_discovery');
    expect(result.suggestedBills[0].normalizedDescription).toBe('NETFLIX');
  });

  it('should prioritize household import rules over system rules', () => {
    const rawData = [
      ['Datum', 'Beskrivning', 'Belopp', 'Saldo'],
      ['2026-06-20', 'HBO MAX', '-89.00', '10000.00'],
    ];

    const rules: HouseholdImportRule[] = [{
      id: 'r1',
      household_id: 'hh1',
      search_string: 'HBO MAX',
      target_id: 'acc1',
      rule_target_type: 'ACCOUNT',
      is_bill: true,
      rule_type: 'USER',
      usage_count: 5,
      matched_examples: [],
      last_seen_at: '2026-06-20'
    }];

    const result = parseBankData(rawData, rules, [{id: 'acc1', name: 'Mitt konto'}], [], [], []);
    
    expect(result.suggestedBills.length).toBe(1);
    expect(result.suggestedBills[0].matchLevel).toBe('confirmed');
    expect(result.suggestedBills[0].suggestedAccountId).toBe('acc1');
  });
  
  it('should ignore already imported bills', () => {
    const rawData = [
      ['Datum', 'Beskrivning', 'Belopp'],
      ['2026-06-20', 'NETFLIX', '-109.00'],
    ];
    
    const knownBills = [{ accountId: 'acc1', defaultAmount: 109, name: 'NETFLIX' }];
    
    const result = parseBankData(rawData, [], [], [], knownBills, []);
    
    // An already imported bill should have matchLevel 'already_imported'
    expect(result.suggestedBills.length).toBe(1);
    expect(result.suggestedBills[0].matchLevel).toBe('already_imported');
  });
});
