import { describe, it, expect } from 'vitest';
import { calculateMonth } from './store';
import type { AppState } from './types';

describe('Splitwise Logic (calculateMonth)', () => {
  it('should split equally between two persons', () => {
    const mockState: Partial<AppState> = {
      accounts: [
        { id: 'person_a', name: 'Person A', type: 'person', transferMethod: 'swish' },
        { id: 'person_b', name: 'Person B', type: 'person', transferMethod: 'swish' }
      ],
      bills: [
        { id: 'bill_1', name: 'Internet', accountId: 'person_a', splitType: 'equal', interval: 'all', defaultAmount: 500, warnIfZero: false }
      ],
      months: {
        '2026-01': {
          monthId: '2026-01',
          billAmounts: { 'bill_1': 500 },
          handledPayments: {},
          confirmedAnomalies: {}
        }
      }
    };

    const result = calculateMonth(mockState as AppState, '2026-01');

    // Person A paid 500 from their account.
    // Both share it equally, so both owe 250.
    // Person B owes Person A 250.
    expect(result.swishes).toHaveLength(1);
    expect(result.swishes[0].fromId).toBe('person_b');
    expect(result.swishes[0].toId).toBe('person_a');
    expect(result.swishes[0].amount).toBe(250);
  });

  it('should handle shared accounts correctly (transfer to shared)', () => {
    const mockState: Partial<AppState> = {
      accounts: [
        { id: 'person_a', name: 'Person A', type: 'person', transferMethod: 'swish' },
        { id: 'person_b', name: 'Person B', type: 'person', transferMethod: 'swish' },
        { id: 'shared_acc', name: 'Gemensamt', type: 'shared', transferMethod: 'transfer' }
      ],
      bills: [
        { id: 'bill_1', name: 'Hyra', accountId: 'shared_acc', splitType: 'equal', interval: 'all', defaultAmount: 10000, warnIfZero: false }
      ],
      months: {
        '2026-01': {
          monthId: '2026-01',
          billAmounts: { 'bill_1': 10000 },
          handledPayments: {},
          confirmedAnomalies: {}
        }
      }
    };

    const result = calculateMonth(mockState as AppState, '2026-01');

    // The bill is drawn from the shared account.
    // Both persons need to transfer 5000 to the shared account.
    expect(result.transfersToShared['person_a']['shared_acc']).toBe(5000);
    expect(result.transfersToShared['person_b']['shared_acc']).toBe(5000);
    expect(result.swishes).toHaveLength(0); // No swish between persons
  });
});
