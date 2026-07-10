import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db, transactions } from '@/lib/db';
import { fmtINR } from '@/lib/finance';
import { TxEntry, TxDelete } from './tx-entry';

export const dynamic = 'force-dynamic';

const DAY = 86400000;

function dayKeyIST(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

export default async function FinancePage() {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(dayStart);
  monthStart.setDate(1);
  const twoWeeksAgo = new Date(dayStart.getTime() - 13 * DAY);

  const [today, byCategory, monthTotal, recent] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(gte(transactions.ts, dayStart))
      .orderBy(desc(transactions.ts))
      .limit(50),
    db
      .select({ category: transactions.category, total: sql<string>`sum(${transactions.amount})` })
      .from(transactions)
      .where(and(gte(transactions.ts, monthStart), eq(transactions.type, 'expense')))
      .groupBy(transactions.category)
      .orderBy(sql`2 desc`),
    db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(gte(transactions.ts, monthStart), eq(transactions.type, 'expense'))),
    db
      .select()
      .from(transactions)
      .where(and(gte(transactions.ts, twoWeeksAgo), eq(transactions.type, 'expense')))
      .limit(1000),
  ]);

  // Daily spend, last 14 days (IST days), oldest → newest.
  const days: { key: string; label: string; total: number; isToday: boolean }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(dayStart.getTime() - i * DAY);
    days.push({
      key: dayKeyIST(d),
      label: new Intl.DateTimeFormat('en-IN', { weekday: 'narrow', timeZone: 'Asia/Kolkata' }).format(d),
      total: 0,
      isToday: i === 0,
    });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const t of recent) {
    const bucket = byKey.get(dayKeyIST(t.ts));
    if (bucket) bucket.total += Number(t.amount);
  }
  const maxDay = Math.max(...days.map((d) => d.total), 1);

  const todaySpend = today
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);
  const maxCat = Math.max(...byCategory.map((c) => Number(c.total)), 1);

  return (
    <main className="space-y-10">
      <section className="flex items-end justify-between">
        <div>
          <h1 className="font-voice text-2xl italic">Finance</h1>
          <p className="mt-1 text-sm text-moth">Log it the moment it leaves your pocket.</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="font-mono text-lg text-linen">{fmtINR(todaySpend)}</p>
            <p className="text-xs text-moth">today</p>
          </div>
          <div>
            <p className="font-mono text-lg text-linen">{fmtINR(Number(monthTotal[0]?.total ?? 0))}</p>
            <p className="text-xs text-moth">this month</p>
          </div>
        </div>
      </section>

      <TxEntry />

      <section>
        <h2 className="mb-3 text-xs font-medium tracking-widest text-moth uppercase">
          Daily spend · last 14 days
        </h2>
        <div className="rounded-xl border border-seam bg-veil/50 px-4 pt-6 pb-3">
          <div className="flex h-32 items-end gap-[3px]">
            {days.map((d) => (
              <div key={d.key} className="group relative flex h-full flex-1 flex-col justify-end">
                <span className="pointer-events-none absolute -top-5 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-night px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-linen group-hover:block">
                  {fmtINR(d.total)}
                </span>
                <div
                  className={`w-full rounded-t ${d.isToday ? 'bg-ember' : 'bg-ember/60 group-hover:bg-ember/90'}`}
                  style={{ height: `${d.total === 0 ? 2 : Math.max((d.total / maxDay) * 100, 4)}%` }}
                />
                <span
                  className={`mt-1.5 text-center font-mono text-[9px] ${d.isToday ? 'text-ember' : 'text-moth/70'}`}
                >
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {byCategory.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-medium tracking-widest text-moth uppercase">
            This month by category
          </h2>
          <ul className="space-y-2.5 rounded-xl border border-seam bg-veil/50 p-4">
            {byCategory.map((c) => {
              const v = Number(c.total);
              return (
                <li key={c.category} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-moth">{c.category}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-seam/60">
                    <div
                      className="h-full rounded-r-full bg-ember"
                      style={{ width: `${Math.max((v / maxCat) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right font-mono text-xs text-linen/90">
                    {fmtINR(v)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-medium tracking-widest text-moth uppercase">Today</h2>
        {today.length === 0 ? (
          <p className="text-sm text-moth">Nothing logged yet today.</p>
        ) : (
          <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
            {today.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="w-20 shrink-0 font-mono text-linen/95">
                  {t.type === 'income' ? <span className="text-sage">+</span> : ''}
                  {fmtINR(Number(t.amount))}
                </span>
                <span className="rounded-full bg-seam/80 px-2 py-0.5 text-[10px] text-moth">
                  {t.category}
                </span>
                <span className="flex-1 truncate text-moth">{t.note}</span>
                <span className="shrink-0 font-mono text-xs text-moth/70">
                  {t.ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                </span>
                <TxDelete id={t.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-moth/60">
        Manual entry is the interim flow — bank/SMS auto-ingestion is on the roadmap.
      </p>
    </main>
  );
}
