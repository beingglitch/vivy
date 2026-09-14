import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import { accounts, balanceSnapshots, db, txnCorrections, txns } from '@vivy/db';
import { refreshSpendRollups } from './money-ingest';
import { ACCOUNT_KINDS, type MoneyDashboard } from './money-shared';

interface SnapshotRow {
  accountId: string;
  asOf: string;
  balanceMinor: number;
  authority: string;
  asOfTs: Date | null;
  createdAt: Date;
}

export async function getMoneyDashboard(userId: string): Promise<MoneyDashboard> {
  const [accountRows, transactionRows, snapshotRows] = await Promise.all([
    db()
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
      .orderBy(asc(accounts.createdAt)),
    db()
      .select()
      .from(txns)
      .where(and(eq(txns.userId, userId), ne(txns.reviewStatus, 'excluded')))
      .orderBy(desc(txns.ts)),
    db()
      .select({
        accountId: balanceSnapshots.accountId,
        asOf: balanceSnapshots.asOf,
        balanceMinor: balanceSnapshots.balanceMinor,
        authority: balanceSnapshots.authority,
        asOfTs: balanceSnapshots.asOfTs,
        createdAt: balanceSnapshots.createdAt,
      })
      .from(balanceSnapshots)
      .where(eq(balanceSnapshots.userId, userId))
      .orderBy(asc(balanceSnapshots.asOf), asc(balanceSnapshots.createdAt)),
  ]);

  const today = localDate(new Date());
  const firstDate = earliestDate(accountRows, transactionRows, snapshotRows, today);
  const datedBalances = dateRange(firstDate, today).map((date) => ({
    date,
    balances: balancesOn(date, accountRows, transactionRows, snapshotRows),
  }));
  const balances = datedBalances.at(-1)?.balances ?? new Map<string, number>();
  const accountViews = accountRows.map((account) => ({
    id: account.id,
    name: account.name,
    kind: account.kind,
    ref: account.ref,
    currency: account.currency,
    isLiability: account.isLiability,
    creditLimitMinor: account.creditLimitMinor,
    includeInNetworth: account.includeInNetworth,
    source: account.source,
    balanceMinor: balances.get(account.id) ?? 0,
    points: datedBalances.map(({ date, balances: dayBalances }) => ({
      date,
      balanceMinor: dayBalances.get(account.id) ?? 0,
    })),
  }));
  const accountNames = new Map(accountRows.map((account) => [account.id, account.name]));
  const transactionViews = transactionRows.map((transaction) => ({
    id: transaction.id,
    accountId: transaction.accountId,
    accountName: accountNames.get(transaction.accountId) ?? 'Unknown account',
    amountMinor: transaction.amountMinor,
    direction: transaction.direction,
    counterparty: transaction.counterparty,
    category: transaction.category,
    localDate: transaction.localDate,
    method: transaction.method,
    confidence: transaction.confidence,
    reviewStatus: transaction.reviewStatus,
    imported: transaction.eventId !== null,
  }));

  const points = datedBalances.map(({ date, balances: dayBalances }) => {
    const assetsMinor = accountRows.reduce((total, account) => {
      if (!account.includeInNetworth || account.isLiability) return total;
      return total + (dayBalances.get(account.id) ?? 0);
    }, 0);
    const liabilitiesMinor = accountRows.reduce((total, account) => {
      if (!account.includeInNetworth || !account.isLiability) return total;
      return total - (dayBalances.get(account.id) ?? 0);
    }, 0);
    const netWorthMinor = accountRows.reduce((total, account) => {
      if (!account.includeInNetworth) return total;
      const balance = dayBalances.get(account.id) ?? 0;
      return total + (account.isLiability ? -balance : balance);
    }, 0);
    const dayTransactions = transactionRows.filter((transaction) => transaction.localDate === date);
    return {
      date,
      netWorthMinor,
      assetsMinor,
      liabilitiesMinor,
      spendMinor: dayTransactions
        .filter((transaction) => transaction.direction === 'debit')
        .reduce((total, transaction) => total + transaction.amountMinor, 0),
      incomeMinor: dayTransactions
        .filter((transaction) => transaction.direction === 'credit')
        .reduce((total, transaction) => total + transaction.amountMinor, 0),
    };
  });

  return {
    accounts: accountViews,
    transactions: transactionViews,
    points,
    netWorthMinor:
      accountRows.length === 0
        ? null
        : accountRows.reduce((total, account) => {
            if (!account.includeInNetworth) return total;
            const balance = balances.get(account.id) ?? 0;
            return total + (account.isLiability ? -balance : balance);
          }, 0),
    pendingCount: transactionRows.filter((transaction) => transaction.reviewStatus === 'pending')
      .length,
  };
}

export async function createMoneyAccount(
  userId: string,
  input: {
    name: string;
    kind: string;
    ref?: string | null;
    balanceMinor: number;
    creditLimitMinor?: number | null;
    asOf: string;
    includeInNetworth: boolean;
  },
): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error('Give the account a name.');
  if (!ACCOUNT_KINDS.includes(input.kind as (typeof ACCOUNT_KINDS)[number])) {
    throw new Error('Choose an account type.');
  }
  validateMoney(input.balanceMinor);
  const creditLimitMinor = validateCreditLimit(input.kind, input.creditLimitMinor);
  validateCreditBalance(input.kind, input.balanceMinor, creditLimitMinor);
  validateDate(input.asOf);

  const id = randomUUID();
  const isLiability = liabilityKind(input.kind);
  await db().transaction(async (transaction) => {
    await transaction.insert(accounts).values({
      id,
      userId,
      name,
      kind: input.kind,
      ref: cleanRef(input.ref),
      currency: 'INR',
      isLiability,
      creditLimitMinor,
      includeInNetworth: input.includeInNetworth,
      source: 'manual',
    });
    await transaction.insert(balanceSnapshots).values({
      userId,
      accountId: id,
      asOf: input.asOf,
      balanceMinor: input.balanceMinor,
      authority: 'manual',
      asOfTs: snapshotTime(input.asOf),
    });
  });
}

export async function updateMoneyAccount(
  userId: string,
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
): Promise<void> {
  const [owned] = await db()
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);
  if (!owned) throw new Error('Account not found.');
  const name = input.name.trim();
  if (!name) throw new Error('Give the account a name.');
  if (!ACCOUNT_KINDS.includes(input.kind as (typeof ACCOUNT_KINDS)[number])) {
    throw new Error('Choose an account type.');
  }
  const isLiability = liabilityKind(input.kind);
  const creditLimitMinor = validateCreditLimit(input.kind, input.creditLimitMinor);
  if (input.balanceMinor !== undefined) {
    validateCreditBalance(input.kind, input.balanceMinor, creditLimitMinor);
  }

  await db().transaction(async (transaction) => {
    await transaction
      .update(accounts)
      .set({
        name,
        kind: input.kind,
        ref: cleanRef(input.ref),
        isLiability,
        creditLimitMinor,
        includeInNetworth: input.includeInNetworth,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
    if (input.balanceMinor !== undefined && input.asOf) {
      validateMoney(input.balanceMinor);
      validateDate(input.asOf);
      await transaction
        .insert(balanceSnapshots)
        .values({
          userId,
          accountId,
          asOf: input.asOf,
          balanceMinor: input.balanceMinor,
          authority: 'manual',
          asOfTs: snapshotTime(input.asOf),
        })
        .onConflictDoUpdate({
          target: [
            balanceSnapshots.userId,
            balanceSnapshots.accountId,
            balanceSnapshots.asOf,
            balanceSnapshots.authority,
          ],
          set: { balanceMinor: input.balanceMinor, asOfTs: snapshotTime(input.asOf) },
        });
    }
  });
}

export async function setMoneyAccountNetWorthVisibility(
  userId: string,
  accountId: string,
  includeInNetworth: boolean,
): Promise<void> {
  const changed = await db()
    .update(accounts)
    .set({ includeInNetworth, updatedAt: new Date() })
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .returning({ id: accounts.id });
  if (changed.length === 0) throw new Error('Account not found.');
}

export async function createManualTransaction(
  userId: string,
  input: {
    accountId: string;
    direction: 'debit' | 'credit';
    amountMinor: number;
    localDate: string;
    counterparty?: string | null;
    category?: string | null;
  },
): Promise<void> {
  await requireAccount(userId, input.accountId);
  validateMoney(input.amountMinor, false);
  validateDate(input.localDate);
  const id = randomUUID();
  await db()
    .insert(txns)
    .values({
      id,
      userId,
      accountId: input.accountId,
      ts: input.localDate === localDate(new Date()) ? new Date() : dateAtNoon(input.localDate),
      localDate: input.localDate,
      amountMinor: input.amountMinor,
      currency: 'INR',
      direction: input.direction,
      method: 'manual',
      counterparty: cleanText(input.counterparty),
      category: cleanText(input.category),
      confidence: 1,
      reviewStatus: 'confirmed',
      reviewedAt: new Date(),
      dedupeKey: `manual:${id}`,
    });
  await refreshSpendRollups(userId, [input.localDate]);
}

export async function reviewMoneyTransaction(
  userId: string,
  transactionId: string,
  action: 'confirm' | 'edit' | 'exclude',
  patch?: {
    accountId?: string;
    amountMinor?: number;
    direction?: 'debit' | 'credit';
    counterparty?: string | null;
    category?: string | null;
  },
): Promise<void> {
  const [current] = await db()
    .select()
    .from(txns)
    .where(and(eq(txns.id, transactionId), eq(txns.userId, userId)))
    .limit(1);
  if (!current) throw new Error('Transaction not found.');

  if (action === 'exclude') {
    await db()
      .update(txns)
      .set({ reviewStatus: 'excluded', reviewedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(txns.id, transactionId), eq(txns.userId, userId)));
    await refreshSpendRollups(userId, [current.localDate]);
    return;
  }
  if (action === 'confirm') {
    await db()
      .update(txns)
      .set({ reviewStatus: 'confirmed', reviewedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(txns.id, transactionId), eq(txns.userId, userId)));
    return;
  }

  const next = {
    accountId: patch?.accountId ?? current.accountId,
    amountMinor: patch?.amountMinor ?? current.amountMinor,
    direction: patch?.direction ?? current.direction,
    counterparty:
      patch?.counterparty === undefined ? current.counterparty : cleanText(patch.counterparty),
    category: patch?.category === undefined ? current.category : cleanText(patch.category),
  };
  await requireAccount(userId, next.accountId);
  validateMoney(next.amountMinor, false);

  await db().transaction(async (transaction) => {
    await transaction.insert(txnCorrections).values({
      id: randomUUID(),
      userId,
      txnId: transactionId,
      before: {
        accountId: current.accountId,
        amountMinor: current.amountMinor,
        direction: current.direction,
        counterparty: current.counterparty,
        category: current.category,
      },
      after: next,
    });
    await transaction
      .update(txns)
      .set({ ...next, reviewStatus: 'corrected', reviewedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(txns.id, transactionId), eq(txns.userId, userId)));
  });
  await refreshSpendRollups(userId, [current.localDate]);
}

export async function confirmAllMoneyTransactions(userId: string): Promise<void> {
  await db()
    .update(txns)
    .set({ reviewStatus: 'confirmed', reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(txns.userId, userId), eq(txns.reviewStatus, 'pending')));
}

function balancesOn(
  date: string,
  accountRows: Array<typeof accounts.$inferSelect>,
  transactionRows: Array<typeof txns.$inferSelect>,
  snapshotRows: SnapshotRow[],
): Map<string, number> {
  return new Map(
    accountRows.map((account) => {
      const snapshots = snapshotRows.filter(
        (snapshot) => snapshot.accountId === account.id && snapshot.asOf <= date,
      );
      const anchor = snapshots.at(-1);
      const anchorTime = anchor?.asOfTs ?? (anchor ? endOfDay(anchor.asOf) : null);
      const balance = transactionRows
        .filter(
          (transaction) =>
            transaction.accountId === account.id &&
            transaction.localDate <= date &&
            (!anchorTime || transaction.ts > anchorTime),
        )
        .reduce(
          (total, transaction) => total + accountDelta(account.isLiability, transaction),
          anchor?.balanceMinor ?? 0,
        );
      return [account.id, balance];
    }),
  );
}

function accountDelta(
  liability: boolean,
  transaction: Pick<typeof txns.$inferSelect, 'direction' | 'amountMinor'>,
): number {
  const assetDelta =
    transaction.direction === 'credit' ? transaction.amountMinor : -transaction.amountMinor;
  return liability ? -assetDelta : assetDelta;
}

function earliestDate(
  accountRows: Array<typeof accounts.$inferSelect>,
  transactionRows: Array<typeof txns.$inferSelect>,
  snapshotRows: SnapshotRow[],
  today: string,
): string {
  if (accountRows.length === 0) return today;
  const dates = [
    ...transactionRows.map((transaction) => transaction.localDate),
    ...snapshotRows.map((snapshot) => snapshot.asOf),
  ].sort();
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setDate(fiveYearsAgo.getDate() - 1_825);
  const floor = localDate(fiveYearsAgo);
  return dates[0] && dates[0] > floor ? dates[0] : floor;
}

function dateRange(from: string, to: string): string[] {
  const result: string[] = [];
  const cursor = dateAtNoon(from);
  const end = dateAtNoon(to);
  while (cursor <= end && result.length < 1_826) {
    result.push(localDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function localDate(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

function dateAtNoon(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12);
}

function endOfDay(value: string): Date {
  const date = dateAtNoon(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function snapshotTime(value: string): Date {
  return value === localDate(new Date()) ? new Date() : endOfDay(value);
}

function validateDate(value: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(dateAtNoon(value).getTime()) ||
    localDate(dateAtNoon(value)) !== value ||
    value > localDate(new Date())
  ) {
    throw new Error('Choose today or an earlier valid date.');
  }
}

function validateMoney(value: number, allowZero = true): void {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error('Enter a valid amount.');
  }
}

function liabilityKind(kind: string): boolean {
  return kind === 'credit-card' || kind === 'loan' || kind === 'personal-debt';
}

function validateCreditLimit(kind: string, value?: number | null): number | null {
  if (kind !== 'credit-card') return null;
  if (value === null || value === undefined) throw new Error('Enter the card maximum limit.');
  validateMoney(value, false);
  return value;
}

function validateCreditBalance(
  kind: string,
  balanceMinor: number,
  creditLimitMinor: number | null,
) {
  if (kind !== 'credit-card' || creditLimitMinor === null) return;
  if (balanceMinor > creditLimitMinor) throw new Error('Card spending cannot exceed its limit.');
}

async function requireAccount(userId: string, accountId: string): Promise<void> {
  const [owned] = await db()
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);
  if (!owned) throw new Error('Choose one of your accounts.');
}

function cleanText(value?: string | null): string | null {
  return value?.trim().slice(0, 120) || null;
}

function cleanRef(value?: string | null): string | null {
  return value?.replace(/\D/g, '').slice(-4) || null;
}
