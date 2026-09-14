'use server';

import { revalidatePath } from 'next/cache';
import {
  confirmAllMoneyTransactions,
  createManualTransaction,
  createMoneyAccount,
  reviewMoneyTransaction,
  setMoneyAccountNetWorthVisibility,
  updateMoneyAccount,
} from '@/lib/money';
import { requireUserId } from '@/lib/session';

export type MoneyResult = { ok: true } | { ok: false; error: string };

function refreshMoney() {
  revalidatePath('/money');
  revalidatePath('/');
}

async function resultFor(work: (userId: string) => Promise<void>): Promise<MoneyResult> {
  try {
    await work(await requireUserId());
    refreshMoney();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save.' };
  }
}

export async function addMoneyAccount(input: {
  name: string;
  kind: string;
  ref?: string | null;
  balanceMinor: number;
  creditLimitMinor?: number | null;
  asOf: string;
  includeInNetworth: boolean;
}): Promise<MoneyResult> {
  return resultFor((userId) => createMoneyAccount(userId, input));
}

export async function editMoneyAccount(
  accountId: string,
  input: {
    name: string;
    kind: string;
    ref?: string | null;
    balanceMinor?: number;
    creditLimitMinor?: number | null;
    asOf?: string;
    includeInNetworth: boolean;
  },
): Promise<MoneyResult> {
  return resultFor((userId) => updateMoneyAccount(userId, accountId, input));
}

export async function setAccountNetWorth(
  accountId: string,
  includeInNetworth: boolean,
): Promise<MoneyResult> {
  return resultFor((userId) =>
    setMoneyAccountNetWorthVisibility(userId, accountId, includeInNetworth),
  );
}

export async function addManualMoneyTransaction(input: {
  accountId: string;
  direction: 'debit' | 'credit';
  amountMinor: number;
  localDate: string;
  counterparty?: string | null;
  category?: string | null;
}): Promise<MoneyResult> {
  return resultFor((userId) => createManualTransaction(userId, input));
}

export async function reviewTransaction(
  transactionId: string,
  action: 'confirm' | 'edit' | 'exclude',
  patch?: {
    accountId?: string;
    amountMinor?: number;
    direction?: 'debit' | 'credit';
    counterparty?: string | null;
    category?: string | null;
  },
): Promise<MoneyResult> {
  return resultFor((userId) => reviewMoneyTransaction(userId, transactionId, action, patch));
}

export async function confirmAllTransactions(): Promise<MoneyResult> {
  return resultFor((userId) => confirmAllMoneyTransactions(userId));
}
