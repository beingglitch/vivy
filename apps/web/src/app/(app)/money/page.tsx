import { count, desc, eq } from 'drizzle-orm';
import { Empty } from '@/components/empty';
import { Dock } from '@/components/shell';
import { db, txns } from '@vivy/db';
import { requirePageUserId } from '@/lib/page-session';

export const dynamic = 'force-dynamic';

/**
 * Money.
 *
 * Reads the ledger materialised from Android money events.
 *
 * Deliberately shows no zero. A net worth of ₹0 is a claim about your finances;
 * "nothing connected" is the truth.
 */
export default async function MoneyPage() {
  const userId = await requirePageUserId();

  let total = 0;
  let recent: Array<{
    id: string;
    counterparty: string | null;
    amountMinor: number;
    direction: string;
    localDate: string;
  }> = [];
  try {
    const [rows, transactionRows] = await Promise.all([
      db().select({ n: count() }).from(txns).where(eq(txns.userId, userId)),
      db()
        .select({
          id: txns.id,
          counterparty: txns.counterparty,
          amountMinor: txns.amountMinor,
          direction: txns.direction,
          localDate: txns.localDate,
        })
        .from(txns)
        .where(eq(txns.userId, userId))
        .orderBy(desc(txns.ts))
        .limit(20),
    ]);
    total = rows[0]?.n ?? 0;
    recent = transactionRows;
  } catch {
    total = 0;
    recent = [];
  }

  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Money</h1>
            <span className="subtitle">
              {total === 0 ? 'Nothing connected' : `${total} transactions`}
            </span>
          </div>
        </div>
      </div>

      <div className="screen screen--flush">
        {recent.length === 0 ? (
          <Empty
            title="No transactions yet"
            hint="Spending is read from bank SMS once the Android app is connected. Holdings come from your broker."
          />
        ) : (
          <div className="money-transactions">
            {recent.map((transaction) => (
              <div className="money-transaction" key={transaction.id}>
                <div>
                  <strong>{transaction.counterparty ?? 'Bank transaction'}</strong>
                  <span>{transaction.localDate}</span>
                </div>
                <b>
                  {transaction.direction === 'debit' ? '-' : '+'}
                  {formatInr(transaction.amountMinor)}
                </b>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dock />
    </>
  );
}

function formatInr(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
