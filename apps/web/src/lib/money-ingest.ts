import { and, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { VivyEvent } from '@vivy/core';
import { accounts, balanceSnapshots, db, metricsDaily, txns } from '@vivy/db';

type MoneyEvent = Extract<VivyEvent, { type: 'money.txn' }>;

export async function materializeMoneyEvents(userId: string, events: VivyEvent[]): Promise<void> {
  const moneyEvents = events.filter((event): event is MoneyEvent => event.type === 'money.txn');
  if (moneyEvents.length === 0) return;

  const conn = db();
  const accountRows = uniqueAccounts(userId, moneyEvents);
  const transactionRows = moneyEvents.map((event) => ({
    id: event.id,
    userId,
    accountId: accountId(userId, event.payload.accountRef),
    ts: new Date(event.ts),
    localDate: event.localDate,
    amountMinor: event.payload.amountMinor,
    currency: event.payload.currency,
    direction: event.payload.direction,
    method: event.payload.method,
    counterparty: event.payload.counterparty,
    category: event.payload.category,
    balanceAfterMinor: event.payload.balanceAfterMinor,
    confidence: event.payload.confidence,
    eventId: event.id,
    dedupeKey: event.dedupeKey,
  }));

  await conn.transaction(async (transaction) => {
    await transaction.insert(accounts).values(accountRows).onConflictDoNothing();
    await transaction
      .insert(txns)
      .values(transactionRows)
      .onConflictDoNothing({ target: [txns.userId, txns.dedupeKey] });
  });

  await refreshBalances(userId, moneyEvents);
  await refreshSpendRollups(userId, [...new Set(moneyEvents.map((event) => event.localDate))]);
}

function uniqueAccounts(userId: string, events: MoneyEvent[]) {
  const refs = [...new Set(events.map((event) => event.payload.accountRef))];
  return refs.map((ref) => ({
    id: accountId(userId, ref),
    userId,
    kind: 'savings',
    name: `Account ${ref}`,
    ref,
    currency: 'INR',
    isLiability: false,
    includeInNetworth: true,
  }));
}

async function refreshBalances(userId: string, events: MoneyEvent[]): Promise<void> {
  const pairs = [
    ...new Map(
      events
        .filter((event) => event.payload.balanceAfterMinor !== null)
        .map((event) => [
          `${event.payload.accountRef}:${event.localDate}`,
          { accountId: accountId(userId, event.payload.accountRef), date: event.localDate },
        ]),
    ).values(),
  ];
  const conn = db();
  for (const pair of pairs) {
    const latest = await conn
      .select({ balanceMinor: txns.balanceAfterMinor, asOfTs: txns.ts })
      .from(txns)
      .where(
        and(
          eq(txns.userId, userId),
          eq(txns.accountId, pair.accountId),
          eq(txns.localDate, pair.date),
          isNotNull(txns.balanceAfterMinor),
        ),
      )
      .orderBy(desc(txns.ts))
      .limit(1);
    const balanceMinor = latest[0]?.balanceMinor;
    const asOfTs = latest[0]?.asOfTs;
    if (balanceMinor === null || balanceMinor === undefined) continue;
    await conn
      .insert(balanceSnapshots)
      .values({
        userId,
        accountId: pair.accountId,
        asOf: pair.date,
        asOfTs,
        balanceMinor,
        authority: 'sms-inferred',
      })
      .onConflictDoUpdate({
        target: [
          balanceSnapshots.userId,
          balanceSnapshots.accountId,
          balanceSnapshots.asOf,
          balanceSnapshots.authority,
        ],
        set: {
          balanceMinor,
          asOfTs,
        },
      });
  }
}

export async function refreshSpendRollups(userId: string, dates: string[]): Promise<void> {
  if (dates.length === 0) return;
  const uniqueDates = [...new Set(dates)];
  const conn = db();
  const totals = await conn
    .select({
      localDate: txns.localDate,
      value: sql<number>`coalesce(sum(${txns.amountMinor}), 0)`.mapWith(Number),
    })
    .from(txns)
    .where(
      and(
        eq(txns.userId, userId),
        eq(txns.direction, 'debit'),
        ne(txns.reviewStatus, 'excluded'),
        inArray(txns.localDate, uniqueDates),
      ),
    )
    .groupBy(txns.localDate);

  const totalsByDate = new Map(totals.map((total) => [total.localDate, total.value]));
  await conn
    .insert(metricsDaily)
    .values(
      uniqueDates.map((localDate) => ({
        userId,
        localDate,
        stream: 'money.spend',
        value: totalsByDate.get(localDate) ?? 0,
        meta: { currency: 'INR' },
        computedAt: new Date(),
      })),
    )
    .onConflictDoUpdate({
      target: [metricsDaily.userId, metricsDaily.localDate, metricsDaily.stream],
      set: {
        value: sql`excluded.value`,
        meta: sql`excluded.meta`,
        computedAt: sql`excluded.computed_at`,
      },
    });
}

function accountId(userId: string, ref: string): string {
  return `${userId}:${ref}`;
}
