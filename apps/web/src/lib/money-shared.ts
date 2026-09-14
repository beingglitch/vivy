export const ACCOUNT_KINDS = [
  'savings',
  'current',
  'cash',
  'wallet',
  'fd',
  'demat',
  'mutual-fund',
  'credit-card',
  'loan',
  'personal-debt',
] as const;

export const MONEY_CATEGORIES = [
  'Food',
  'Rent',
  'Travel',
  'Subscriptions',
  'Health',
  'Shopping',
  'Bills',
  'Salary',
  'Investment',
  'Other',
] as const;

export interface MoneyAccount {
  id: string;
  name: string;
  kind: string;
  ref: string | null;
  currency: string;
  isLiability: boolean;
  includeInNetworth: boolean;
  source: string;
  balanceMinor: number;
  points: AccountBalancePoint[];
}

export interface AccountBalancePoint {
  date: string;
  balanceMinor: number;
}

export interface MoneyTransaction {
  id: string;
  accountId: string;
  accountName: string;
  amountMinor: number;
  direction: string;
  counterparty: string | null;
  category: string | null;
  localDate: string;
  method: string;
  confidence: number;
  reviewStatus: string;
  imported: boolean;
}

export interface MoneyPoint {
  date: string;
  netWorthMinor: number;
  spendMinor: number;
  incomeMinor: number;
}

export interface MoneyDashboard {
  accounts: MoneyAccount[];
  transactions: MoneyTransaction[];
  points: MoneyPoint[];
  netWorthMinor: number | null;
  pendingCount: number;
}
