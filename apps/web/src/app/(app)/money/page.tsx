import { count, eq } from 'drizzle-orm';
import { Empty } from '@/components/empty';
import { Dock } from '@/components/shell';
import { db, txns } from '@vivy/db';
import { requireUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Money.
 *
 * Reads the ledger. Nothing writes to it yet: the SMS parser exists and is
 * tested, but no collector feeds it, so every account starts here.
 *
 * Deliberately shows no zero. A net worth of ₹0 is a claim about your finances;
 * "nothing connected" is the truth.
 */
export default async function MoneyPage() {
  const userId = await requireUserId();

  let total = 0;
  try {
    const rows = await db()
      .select({ n: count() })
      .from(txns)
      .where(eq(txns.userId, userId));
    total = rows[0]?.n ?? 0;
  } catch {
    total = 0;
  }

  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Money</h1>
            <span className="subtitle">{total === 0 ? 'Nothing connected' : `${total} transactions`}</span>
          </div>
        </div>
      </div>

      <div className="screen screen--flush">
        <Empty
          title="No transactions yet"
          hint="Spending is read from bank SMS once the Android app is connected. Holdings come from your broker."
        />
      </div>

      <Dock />
    </>
  );
}
