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
  splitType: 'equal' | 'proportional' | string; // 'equal' means divide among all persons. Specific accountId means 100% liability for that person. 'proportional' splits based on income.
  defaultAmount: number;
  interval: PaymentInterval;
  customMonths?: number[]; // Array of 1-12
  warnIfZero: boolean;
  isLoan?: boolean;
  totalDebt?: number;
  fixedFee?: number;
  isArchived?: boolean;
  isAutoTransfer?: string; // 'all' = hela räkningen, eller ett personkonto-ID = bara den personen förs automatiskt. Undefined/'' = manuell.
  startMonth?: string; // YYYY-MM
}

export interface MonthData {
  monthId: string; // YYYY-MM
  billAmounts: Record<string, number>; // billId -> amount
  billAmortization?: Record<string, number>; // billId -> amortization
  billInterest?: Record<string, number>; // billId -> interest
  billFee?: Record<string, number>; // billId -> fee
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
  fixedFee?: number;
  isArchived?: boolean;
  startMonth?: string;
}

export interface PrivateMonthData {
  monthId: string;
  billAmounts: Record<string, number>;
  billAmortization?: Record<string, number>;
  billInterest?: Record<string, number>;
  billFee?: Record<string, number>;
  handledPayments?: Record<string, boolean>;
  confirmedAnomalies?: Record<string, boolean>;
  isLocked?: boolean;
}

export interface Profile {
  id: string;
  email?: string;
  role?: string;
  display_name?: string;
  share_private_economy?: boolean;
  person_account_id?: string;
}

export interface Income {
  id: string;
  userId: string;
  name: string;
  amount: number;
  type: 'fixed' | 'variable';
  payDate?: string; // 'YYYY-MM-DD', endast för rörliga inkomster
}

export interface AppState {
  accounts: Account[];
  bills: BillDefinition[];
  months: Record<string, MonthData>;
  privateBills?: PrivateBill[];
  privateMonths?: Record<string, PrivateMonthData>;
  householdProfiles?: Profile[];
  incomes?: Income[];
  settings?: {
    showSummary?: boolean;
    showSwishSummary?: boolean;
    showTransferSummary?: boolean;
    enableManagementButtons?: boolean;
    showTopTotal?: boolean;
    showPrivateTopTotal?: boolean;
    reminderDay?: number;
  };
  stripeStatus?: 'free' | 'active' | 'canceled' | 'vip' | 'past_due';
  paywallActive?: boolean;
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

export interface HouseholdImportRule {
  id: string;
  household_id: string;
  search_string: string;
  target_id: string | null;
  rule_target_type: 'ACCOUNT' | 'USER';
  is_bill: boolean;
  rule_type: 'SYSTEM' | 'USER';
  usage_count: number;
  matched_examples: string[];
  last_seen_at: string;
}
