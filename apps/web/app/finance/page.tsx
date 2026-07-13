import { and, asc, desc, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm';
import { db, networthSnapshots, positions, recurring, transactions } from '@/lib/db';
import { CATEGORY_COLORS, FOLD_COLOR, fmtINR, fmtINRShort } from '@/lib/finance';
import { getProfile } from '@/lib/settings';
import { AgeDisplay } from '@/app/age-display';
import { TxEntry, TxDelete } from './tx-entry';
import { PositionRow, AddPosition, RecurringRow, AddRecurring } from './manage';
import type { Position, Recurring } from './manage';

export const dynamic = 'force-dynamic';

const DAY = 86400000;

function dayKeyIST(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

// Donut of this month's spend. Categories with a fixed color get a segment;
// the rest fold into "everything else" (they still show in the list below).
function Donut({
  slices,
  total,
}: {
  slices: { label: string; value: number; color: string }[];
  total: number;
}) {
  const R = 15.9155; // circumference = 100, so lengths are percentages
  let start = 0;
  const gap = slices.length > 1 ? 1 : 0;
  return (
    <svg
      viewBox="0 0 42 42"
      role="img"
      aria-label="Spend by category"
      className="h-44 w-44 shrink-0 -rotate-90"
    >
      <circle cx="21" cy="21" r={R} fill="none" stroke="var(--color-seam)" strokeWidth="5.5" opacity="0.4" />
      {slices.map((s) => {
        const len = (s.value / total) * 100;
        const el = (
          <circle
            key={s.label}
            cx="21"
            cy="21"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="5.5"
            strokeDasharray={`${Math.max(len - gap, 0.6)} ${100 - Math.max(len - gap, 0.6)}`}
            strokeDashoffset={-start}
          >
            <title>{`${s.label}: ${fmtINR(s.value)} (${Math.round(len)}%)`}</title>
          </circle>
        );
        start += len;
        return el;
      })}
    </svg>
  );
}

// Net worth over time — one series, so no legend; the hero number above names it.
// Dashed line marks zero: above it you own more than you owe.
function NetWorthTrend({ points }: { points: { day: string; net: number }[] }) {
  const W = 640;
  const H = 150;
  const PAD = 10;
  const nets = points.map((p) => p.net);
  let min = Math.min(...nets, 0);
  let max = Math.max(...nets, 0);
  const span = max - min || 1;
  min -= span * 0.08;
  max += span * 0.08;
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i / (points.length - 1)) * (W - 2 * PAD));
  const y = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - 2 * PAD);
  const zeroY = y(0);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.net).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${x(0).toFixed(1)},${zeroY.toFixed(1)} Z`;
  const color = points[points.length - 1].net >= 0 ? 'var(--color-sage)' : 'var(--color-rose)';
  const fmtDay = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Net worth over time" className="w-full">
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="var(--color-seam)" strokeDasharray="4 4" />
        <text x={W - PAD} y={zeroY - 4} textAnchor="end" fontSize="10" fill="var(--color-moth)" opacity="0.7">
          ₹0
        </text>
        {points.length > 1 && (
          <>
            <path d={area} fill={color} opacity="0.12" />
            <path
              d={line}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}
        {points.map((p, i) => (
          <circle
            key={p.day}
            cx={x(i)}
            cy={y(p.net)}
            r={i === points.length - 1 ? 4 : 2.5}
            fill={color}
            stroke="var(--color-veil)"
            strokeWidth={i === points.length - 1 ? 2 : 0}
          >
            <title>{`${fmtDay(p.day)}: ${p.net < 0 ? '−' : ''}${fmtINR(Math.abs(p.net))}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex items-baseline justify-between gap-3 font-mono text-[10px] text-moth/70">
        <span className="shrink-0 whitespace-nowrap">{fmtDay(points[0].day)}</span>
        {points.length === 1 ? (
          <span className="text-right">day one — the line grows from here, one point a day</span>
        ) : (
          <span className="shrink-0 whitespace-nowrap">{fmtDay(points[points.length - 1].day)}</span>
        )}
      </div>
    </div>
  );
}

export default async function FinancePage() {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(dayStart);
  monthStart.setDate(1);
  const twoWeeksAgo = new Date(dayStart.getTime() - 13 * DAY);
  const thirtyAgo = new Date(dayStart.getTime() - 30 * DAY);

  const [
    today,
    byCategory,
    monthIncome,
    recent,
    monthPace,
    allPositions,
    allRecurring,
    snapshots,
    profile,
    monthBillPayments,
  ] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(gte(transactions.ts, dayStart))
      .orderBy(desc(transactions.ts))
      .limit(50),
    db
      .select({
        category: transactions.category,
        total: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(and(gte(transactions.ts, monthStart), eq(transactions.type, 'expense')))
      .groupBy(transactions.category)
      .orderBy(sql`2 desc`),
    db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(gte(transactions.ts, monthStart), eq(transactions.type, 'income'))),
    // Both exclude bill payments: the 14-day chart and the variable pace are
    // about day-to-day spending — bills are already counted via `recurring`.
    db
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.ts, twoWeeksAgo),
          eq(transactions.type, 'expense'),
          isNull(transactions.recurringId),
        ),
      )
      .limit(1000),
    db
      .select({
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
        first: sql<string>`min(${transactions.ts})`,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.ts, thirtyAgo),
          eq(transactions.type, 'expense'),
          isNull(transactions.recurringId),
        ),
      ),
    db.select().from(positions).orderBy(desc(positions.value)),
    db.select().from(recurring).orderBy(desc(recurring.amount)),
    db.select().from(networthSnapshots).orderBy(asc(networthSnapshots.day)).limit(365),
    getProfile(),
    db
      .select({
        recurringId: transactions.recurringId,
        total: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.ts, monthStart),
          eq(transactions.type, 'expense'),
          isNotNull(transactions.recurringId),
        ),
      )
      .groupBy(transactions.recurringId),
  ]);

  // ---- month numbers ----
  const monthSpend = byCategory.reduce((s, c) => s + Number(c.total), 0);
  const incomeMonth = Number(monthIncome[0]?.total ?? 0);
  // Bills vs daily: a payment linked to a recurring rule is a bill; the rest is
  // day-to-day spending. Same total, two very different stories.
  const paidByBill = new Map(monthBillPayments.map((b) => [b.recurringId!, Number(b.total)]));
  const billsPaid = [...paidByBill.values()].reduce((s, v) => s + v, 0);
  const dailySpend = monthSpend - billsPaid;
  // The header's "daily" is just today — the other two lenses are month-wide.
  const todayDaily = today
    .filter((t) => t.type === 'expense' && !t.recurringId)
    .reduce((s, t) => s + Number(t.amount), 0);

  // ---- donut slices: fixed color per category, rest folds ----
  const colored = byCategory.filter((c) => CATEGORY_COLORS[c.category]);
  const folded = byCategory.filter((c) => !CATEGORY_COLORS[c.category]);
  const foldTotal = folded.reduce((s, c) => s + Number(c.total), 0);
  const slices = [
    ...colored.map((c) => ({
      label: c.category,
      value: Number(c.total),
      color: CATEGORY_COLORS[c.category],
    })),
    ...(foldTotal > 0 ? [{ label: 'everything else', value: foldTotal, color: FOLD_COLOR }] : []),
  ];

  // ---- net worth (only `consider` positions count; excluded ones still show) ----
  const assets = allPositions.filter((p) => p.kind === 'asset') as Position[];
  const liabilities = allPositions.filter((p) => p.kind === 'liability') as Position[];
  const assetTotal = assets.filter((p) => p.consider).reduce((s, p) => s + Number(p.value), 0);
  const liabilityTotal = liabilities.filter((p) => p.consider).reduce((s, p) => s + Number(p.value), 0);
  const netWorth = assetTotal - liabilityTotal;
  const excludedTotal = allPositions
    .filter((p) => !p.consider)
    .reduce((s, p) => s + Number(p.value) * (p.kind === 'asset' ? 1 : -1), 0);
  const maxPosition = Math.max(...allPositions.map((p) => Number(p.value)), 1);
  const plannedPayments = liabilities.reduce((s, p) => s + Number(p.nextOutflow ?? 0), 0);
  const trend = snapshots.map((s) => ({ day: s.day, net: Number(s.net) }));

  // ---- recurring + forecast ----
  const activeRec = allRecurring.filter((r) => r.active);
  const recurringExp = activeRec
    .filter((r) => r.type === 'expense')
    .reduce((s, r) => s + Number(r.amount), 0);
  const recurringInc = activeRec.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
  // Variable pace: what I actually logged in the last 30 days, scaled to a month.
  const paceDays = monthPace[0]?.first
    ? Math.max(Math.min((Date.now() - new Date(monthPace[0].first).getTime()) / DAY, 30), 1)
    : 0;
  const variableMonthly = paceDays ? (Number(monthPace[0].total) / paceDays) * 30 : 0;
  const forecast = recurringExp + plannedPayments + variableMonthly;

  // ---- daily spend, last 14 days (IST) ----
  const days: {
    key: string;
    label: string;
    total: number;
    isToday: boolean;
  }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(dayStart.getTime() - i * DAY);
    days.push({
      key: dayKeyIST(d),
      label: new Intl.DateTimeFormat('en-IN', {
        weekday: 'narrow',
        timeZone: 'Asia/Kolkata',
      }).format(d),
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
  const maxFlow = Math.max(incomeMonth, monthSpend, 1);

  return (
    <main className="space-y-10">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-voice text-2xl italic">Finance</h1>
          <p className="mt-1 text-sm text-moth">Log it the moment it leaves your pocket.</p>
        </div>
        {/* One month, three lenses: daily (non-recurring only) + recurring = monthly. */}
        <div className="flex gap-6 text-right">
          <div>
            <p className="font-mono text-lg text-linen">{fmtINR(todayDaily)}</p>
            <p className="text-xs text-moth">daily</p>
          </div>
          <div>
            <p className="font-mono text-lg text-linen">{fmtINR(monthSpend)}</p>
            <p className="text-xs text-moth">monthly</p>
          </div>
          <div>
            <p className="font-mono text-lg text-linen">
              {fmtINR(billsPaid)}
              <span className="text-xs text-moth"> of {fmtINRShort(recurringExp)}</span>
            </p>
            <p className="text-xs text-moth">recurring</p>
          </div>
        </div>
      </section>

      {/* The numbers that matter most, side by side: money and the clock. */}
      <section className="rounded-xl border border-seam bg-veil/50 px-4 pt-8 pb-4 text-center">
        <div className="flex items-end justify-center gap-5 sm:gap-10">
          <div>
            <p className="text-xs font-medium tracking-widest text-moth uppercase">Net worth</p>
            <p
              className={`mt-2 font-mono text-3xl tracking-tight sm:text-6xl ${netWorth >= 0 ? 'text-sage' : 'text-rose'}`}
            >
              {netWorth < 0 ? '−' : ''}
              {fmtINR(Math.abs(netWorth))}
            </p>
          </div>
          {profile.dob && (
            <>
              <div className="h-12 w-px bg-seam sm:h-16" aria-hidden />
              <AgeDisplay
                dob={profile.dob}
                numberClass="mt-2 font-mono text-3xl tracking-tight text-linen sm:text-6xl"
              />
            </>
          )}
        </div>
        <p className="mt-3 text-xs text-moth">
          own <span className="font-mono text-sage">{fmtINR(assetTotal)}</span> · owe{' '}
          <span className="font-mono text-rose">{fmtINR(liabilityTotal)}</span>
          {excludedTotal !== 0 && (
            <span className="text-moth/60">
              {' '}
              · not counting {fmtINRShort(Math.abs(excludedTotal))} excluded (with it{' '}
              <span className="font-mono">
                {netWorth + excludedTotal < 0 ? '−' : ''}
                {fmtINRShort(Math.abs(netWorth + excludedTotal))}
              </span>
              )
            </span>
          )}
        </p>
        {trend.length > 0 && (
          <div className="mt-5">
            <NetWorthTrend points={trend} />
          </div>
        )}
      </section>

      <TxEntry
        bills={activeRec
          .filter((r) => r.type === 'expense')
          .map((r) => ({
            id: r.id,
            name: r.name,
            amount: Number(r.amount),
            category: r.category,
            paid: paidByBill.has(r.id),
          }))}
      />

      {/* Everything daily lives right under the entry form. */}
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
                {t.recurringId && (
                  <span className="rounded-full border border-sage/40 px-2 py-0.5 text-[10px] text-sage/90">
                    bill
                  </span>
                )}
                <span className="flex-1 truncate text-moth">{t.note}</span>
                <span className="shrink-0 font-mono text-xs text-moth/70">
                  {t.ts.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Kolkata',
                  })}
                </span>
                <TxDelete id={t.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

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
                  style={{
                    height: `${d.total === 0 ? 2 : Math.max((d.total / maxDay) * 100, 4)}%`,
                  }}
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

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-seam bg-veil/50 p-4">
          <h2 className="mb-3 text-xs font-medium tracking-widest text-moth uppercase">
            This month by category
          </h2>
          {slices.length === 0 ? (
            <p className="text-sm text-moth">No expenses logged this month yet.</p>
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <div className="relative">
                <Donut slices={slices} total={monthSpend} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-sm text-linen">{fmtINRShort(monthSpend)}</span>
                  <span className="text-[10px] text-moth">spent</span>
                </div>
              </div>
              <ul className="w-full min-w-0 flex-1 space-y-1.5 text-xs">
                {slices.map((s) => (
                  <li key={s.label} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: s.color }}
                      aria-hidden
                    />
                    <span className="truncate text-moth">{s.label}</span>
                    <span className="ml-auto font-mono text-linen/90">{fmtINRShort(s.value)}</span>
                    <span className="w-9 text-right font-mono text-moth/60">
                      {Math.round((s.value / monthSpend) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-seam bg-veil/50 p-4">
            <h2 className="mb-3 text-xs font-medium tracking-widest text-moth uppercase">
              Money flow · this month
            </h2>
            <div className="space-y-2.5">
              {[
                { label: 'in', value: incomeMonth, color: 'bg-sage' },
                { label: 'out', value: monthSpend, color: 'bg-ember' },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-3 text-sm">
                  <span className="w-8 shrink-0 text-xs text-moth">{r.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-seam/60">
                    <div
                      className={`h-full rounded-r-full ${r.color}`}
                      style={{
                        width: `${Math.max((r.value / maxFlow) * 100, 1.5)}%`,
                      }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right font-mono text-xs text-linen/90">
                    {fmtINR(r.value)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-moth">
              net{' '}
              <span className={`font-mono ${incomeMonth - monthSpend >= 0 ? 'text-sage' : 'text-rose'}`}>
                {incomeMonth - monthSpend >= 0 ? '+' : '−'}
                {fmtINR(Math.abs(incomeMonth - monthSpend))}
              </span>{' '}
              · out = <span className="font-mono">{fmtINR(billsPaid)}</span> bills +{' '}
              <span className="font-mono">{fmtINR(dailySpend)}</span> daily
            </p>
          </div>

          <div className="rounded-xl border border-seam bg-veil/50 p-4">
            <h2 className="mb-2 text-xs font-medium tracking-widest text-moth uppercase">
              Next month, roughly
            </h2>
            <p className="font-mono text-xl text-linen">{fmtINR(Math.round(forecast))}</p>
            <p className="mt-1 text-xs text-moth">
              {fmtINR(recurringExp)} recurring
              {plannedPayments > 0 ? ` + ${fmtINR(plannedPayments)} debt payments` : ''} +{' '}
              {fmtINR(Math.round(variableMonthly))} variable at your current pace
              {recurringInc > 0 ? ` · ${fmtINR(recurringInc)}/mo income` : ''}
            </p>
            <p className="mt-1.5 text-[10px] text-moth/60">
              estimate from the last {Math.round(paceDays) || 0} day
              {Math.round(paceDays) === 1 ? '' : 's'} of logged spends — gets sharper as you log
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-medium tracking-widest text-moth uppercase">
            Net worth
            <span
              className={`ml-3 font-mono text-sm normal-case ${netWorth >= 0 ? 'text-sage' : 'text-rose'}`}
            >
              {netWorth >= 0 ? '' : '−'}
              {fmtINR(Math.abs(netWorth))}
            </span>
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              {
                kind: 'asset',
                label: 'Assets',
                items: assets,
                total: assetTotal,
              },
              {
                kind: 'liability',
                label: 'Liabilities',
                items: liabilities,
                total: liabilityTotal,
              },
            ] as const
          ).map((col) => (
            <div key={col.kind} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs text-moth">
                  {col.label}
                  <span className="ml-2 font-mono text-[11px] text-linen/80">{fmtINR(col.total)}</span>
                </h3>
                <AddPosition kind={col.kind} />
              </div>
              {col.items.length === 0 ? (
                <p className="rounded-xl border border-seam bg-veil/30 px-4 py-3 text-xs text-moth/70">
                  Nothing here yet — add{' '}
                  {col.kind === 'asset' ? 'bank balances, investments…' : 'loans, dues…'}
                </p>
              ) : (
                <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
                  {col.items.map((p) => (
                    <PositionRow key={p.id} item={p} max={maxPosition} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-medium tracking-widest text-moth uppercase">
            Recurring
            <span className="ml-3 font-mono text-[11px] normal-case text-linen/80">
              −{fmtINR(recurringExp)}/mo
              {recurringInc > 0 ? ` · +${fmtINR(recurringInc)}/mo` : ''}
            </span>
          </h2>
          <AddRecurring />
        </div>
        {recurringExp > 0 && (
          <div className="mb-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-seam/60">
              <div
                className="h-full rounded-r-full bg-sage"
                style={{
                  width: `${Math.min((billsPaid / recurringExp) * 100, 100)}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-moth">
              <span className="font-mono text-linen/90">{fmtINR(billsPaid)}</span> settled of{' '}
              <span className="font-mono">{fmtINR(recurringExp)}</span> this month
            </p>
          </div>
        )}
        {allRecurring.length === 0 ? (
          <p className="rounded-xl border border-seam bg-veil/30 px-4 py-3 text-xs text-moth/70">
            Rent, salary, subscriptions — add them once and the forecast uses them every month.
          </p>
        ) : (
          <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
            {allRecurring.map((r) => (
              <RecurringRow key={r.id} item={r as Recurring} paidThisMonth={paidByBill.get(r.id)} />
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
