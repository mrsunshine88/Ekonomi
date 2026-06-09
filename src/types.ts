export interface Account {
  id: string;
  name: string;
  type: 'shared' | 'person';
  transferMethod?: 'transfer' | 'swish';
}

export type PaymentInterval = 'all' | 'odd' | 'even' | 'custom';

export interface BillDefinition {
  id: string;
  name: string;
  accountId: string; // id of the Account
  splitType: 'equal' | string; // 'equal' means divide among all persons. Specific accountId means 100% liability for that person.
  defaultAmount: number;
  interval: PaymentInterval;
  customMonths?: number[]; // Array of 1-12
  warnIfZero: boolean;
  isLoan?: boolean;
  totalDebt?: number;
  isArchived?: boolean;
  isAutoTransfer?: string; // 'all' = hela räkningen, eller ett personkonto-ID = bara den personen förs automatiskt. Undefined/'' = manuell.
  startMonth?: string; // YYYY-MM
}

export interface MonthData {
  monthId: string; // YYYY-MM
  billAmounts: Record<string, number>; // billId -> amount
  handledPayments?: Record<string, boolean>; // paymentId -> true/false
  confirmedAnomalies?: Record<string, boolean>; // billId -> true/false
}

export interface PrivateBill {
  id: string;
  name: string;
  defaultAmount: number;
  interval: PaymentInterval;
  customMonths?: number[];
  warnIfZero?: boolean;
  userId: string;
  isShared?: boolean;
  isLoan?: boolean;
  totalDebt?: number;
  isArchived?: boolean;
  startMonth?: string;
}

export interface PrivateMonthData {
  monthId: string;
  billAmounts: Record<string, number>;
  handledPayments?: Record<string, boolean>;
  confirmedAnomalies?: Record<string, boolean>;
  isLocked?: boolean;
}

export interface Profile {
  id: string;
  display_name?: string;
  share_private_economy?: boolean;
}

export interface AppState {
  accounts: Account[];
  bills: BillDefinition[];
  months: Record<string, MonthData>;
  privateBills?: PrivateBill[];
  privateMonths?: Record<string, PrivateMonthData>;
  householdProfiles?: Profile[];
  settings?: {
    showSummary?: boolean;
  };
}

export interface SwishTransfer {
  fromId: string;
  toId: string;
  amount: number;
}

export interface CalculationResult {
  transfersToShared: Record<string, Record<string, number>>; // personId -> sharedAccountId -> amount
  swishes: SwishTransfer[]; // who swishes whom
}
