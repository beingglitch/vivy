import Link from 'next/link';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db, briefs, events, learning, positions, tasks, transactions } from '@/lib/db';
import { browsingStats, fmtDuration } from '@/lib/browsing';
import { fmtINR, fmtINRShort } from '@/lib/finance';
import { ageYears, getProfile } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const DAY = 86400000;

function istDayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

function greeting(name?: string): string {
  const h = Number(
    new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()),
  );
  const who = name ? `, ${name}` : '';
  if (h < 5) return `Still up${who}?`;
  if (h < 12) return `Good morning${who}.`;
  if (h < 17) return `Good afternoon${who}.`;
  return `Good evening${who}.`;
}

type DayBucket = { key: string; label: string; value: number; isToday: boolean };

function makeDays(n: number): DayBucket[] {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const days: DayBucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(dayStart.getTime() - i * DAY);
    days.push({
      key: istDayKey(d),
      label: new Intl.DateTimeFormat('en-IN', { weekday: 'narrow', timeZone: 'Asia/Kolkata' }).format(d),
      value: 0,
      isToday: i === 0,
    });
  }
  return days;
}

// One small daily bar chart: consumption wears ember, output wears sage.
function Bars({
  days,
  color,
  fmt,
}: {
  days: DayBucket[];
  color: 'ember' | 'sage';
  fmt: (v: number) => string;
}) {
  const max = Math.max(...days.map((d) => d.value), 1);
  const bar = color === 'ember' ? 'bg-ember' : 'bg-sage';
  const dim = color === 'ember' ? 'bg-ember/50' : 'bg-sage/50';
  return (
    <div className="flex h-24 items-end gap-[3px]">
      {days.map((d) => (
        <div key={d.key} className="group relative flex h-full flex-1 flex-col justify-end">
          <span className="pointer-events-none absolute -top-5 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-night px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-linen group-hover:block">
            {fmt(d.value)}
          </span>
          <div
            className={`w-full rounded-t ${d.isToday ? bar : `${dim} group-hover:${bar}`}`}
            style={{ height: `${d.value === 0 ? 2 : Math.max((d.value / max) * 100, 5)}%` }}
          />
          <span
            className={`mt-1 text-center font-mono text-[8px] ${d.isToday ? (color === 'ember' ? 'text-ember' : 'text-sage') : 'text-moth/60'}`}
          >
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-seam bg-veil/50 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-medium tracking-widest text-moth uppercase">{title}</h2>
        <Link href={href} className="font-mono text-[10px] text-hush transition-colors hover:text-linen">
          {subtitle} →
        </Link>
      </div>
      {children}
    </section>
  );
}

export default async function Dashboard() {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const twoWeeksAgo = new Date(dayStart.getTime() - 13 * DAY);
  const monthStart = new Date(dayStart);
  monthStart.setDate(1);

  const [
    browserEvents,
    doneTasks,
    learnLogs,
    spendRows,
    openCount,
    activeLearning,
    latestBrief,
    todayStats,
    allPositions,
    profile,
    monthAgg,
  ] = await Promise.all([
      db
        .select({ ts: events.ts, type: events.type, payload: events.payload })
        .from(events)
        .where(and(eq(events.source, 'browser'), gte(events.ts, twoWeeksAgo)))
        .limit(5000),
      db
        .select({ completedAt: tasks.completedAt })
        .from(tasks)
        .where(and(eq(tasks.status, 'done'), gte(tasks.completedAt, twoWeeksAgo))),
      db
        .select({ ts: events.ts, payload: events.payload })
        .from(events)
        .where(and(eq(events.type, 'learning.log'), gte(events.ts, twoWeeksAgo))),
      db
        .select({ ts: transactions.ts, amount: transactions.amount })
        .from(transactions)
        .where(and(gte(transactions.ts, twoWeeksAgo), eq(transactions.type, 'expense'))),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(tasks)
        .where(sql`${tasks.status} in ('inbox','today','doing')`),
      db
        .select()
        .from(learning)
        .where(eq(learning.status, 'active'))
        .orderBy(desc(learning.createdAt))
        .limit(6),
      db.select().from(briefs).orderBy(desc(briefs.day)).limit(1),
      browsingStats(dayStart),
      db.select().from(positions),
      getProfile(),
      // month-to-date rollups for the daily/monthly stat tiles, in one round trip
      db
        .select({
          screenSec: sql<string>`coalesce(sum((${events.payload}->>'seconds')::numeric) filter (where ${events.source} = 'browser' and ${events.ts} >= ${monthStart}), 0)`,
          units: sql<string>`coalesce(sum((${events.payload}->>'units')::numeric) filter (where ${events.type} = 'learning.log' and ${events.ts} >= ${monthStart}), 0)`,
        })
        .from(events)
        .where(gte(events.ts, monthStart)),
      ]);

  const [monthSpendRow, monthDoneRow] = await Promise.all([
    db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(gte(transactions.ts, monthStart), eq(transactions.type, 'expense'))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(eq(tasks.status, 'done'), gte(tasks.completedAt, monthStart))),
  ]);

  // Bucket everything into IST days.
  const screenDays = makeDays(14);
  const screenByKey = new Map(screenDays.map((d) => [d.key, d]));
  for (const e of browserEvents) {
    const b = screenByKey.get(istDayKey(e.ts));
    if (b) b.value += Number((e.payload as Record<string, unknown>).seconds ?? 0);
  }

  const taskDays = makeDays(14);
  const taskByKey = new Map(taskDays.map((d) => [d.key, d]));
  for (const t of doneTasks) {
    if (!t.completedAt) continue;
    const b = taskByKey.get(istDayKey(t.completedAt));
    if (b) b.value += 1;
  }

  const readDays = makeDays(14);
  const readByKey = new Map(readDays.map((d) => [d.key, d]));
  for (const l of learnLogs) {
    const b = readByKey.get(istDayKey(l.ts));
    if (b) b.value += Number((l.payload as Record<string, unknown>).units ?? 0);
  }

  const spendDays = makeDays(14);
  const spendByKey = new Map(spendDays.map((d) => [d.key, d]));
  for (const t of spendRows) {
    const b = spendByKey.get(istDayKey(t.ts));
    if (b) b.value += Number(t.amount);
  }

  const spendToday = spendDays[spendDays.length - 1].value;
  const brief = latestBrief[0];
  const maxDomain = Math.max(...todayStats.domains.map((d) => d.seconds), 1);

  // The one number Vivy exists to move: net worth, from live positions.
  const considered = allPositions.filter((p) => p.consider);
  const ownTotal = considered.filter((p) => p.kind === 'asset').reduce((s, p) => s + Number(p.value), 0);
  const oweTotal = considered.filter((p) => p.kind === 'liability').reduce((s, p) => s + Number(p.value), 0);
  const netWorth = ownTotal - oweTotal;

  const monthScreen = Number(monthAgg[0]?.screenSec ?? 0);
  const monthUnits = Number(monthAgg[0]?.units ?? 0);
  const monthSpend = Number(monthSpendRow[0]?.total ?? 0);
  const monthDone = monthDoneRow[0]?.n ?? 0;
  const unitsToday = readDays[readDays.length - 1].value;

  // Each tile: today's number big, this month's beneath it.
  const tiles = [
    { label: 'screen today', value: fmtDuration(screenDays[13].value), month: `${fmtDuration(monthScreen)} this month` },
    { label: 'open tasks', value: String(openCount[0]?.n ?? 0), month: `${monthDone} done this month` },
    { label: 'chapters today', value: String(unitsToday), month: `${monthUnits} this month` },
    { label: 'spent today', value: fmtINR(spendToday), month: `${fmtINR(monthSpend)} this month` },
  ];

  const firstName = profile.name.split(' ')[0];
  const age = ageYears(profile.dob);

  return (
    <main className="space-y-8">
      <section>
        <p className="font-voice text-2xl italic text-linen">{greeting(firstName || undefined)}</p>
        <h1 className="mt-1 text-sm text-moth">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'Asia/Kolkata',
          })}
        </h1>
      </section>

      {/* The mission numbers, side by side: what you have, and how much of the
          clock is already spent. The pairing IS the message. */}
      <Link
        href="/finance"
        className="block rounded-xl border border-seam bg-veil/50 px-4 py-6 text-center transition-colors hover:border-ember/40"
      >
        <div className="flex items-end justify-center gap-5 sm:gap-8">
          <div>
            <p className="text-xs font-medium tracking-widest text-moth uppercase">Net worth</p>
            <p
              className={`mt-1.5 font-mono text-3xl tracking-tight sm:text-5xl ${netWorth >= 0 ? 'text-sage' : 'text-rose'}`}
            >
              {netWorth < 0 ? '−' : ''}
              {fmtINR(Math.abs(netWorth))}
            </p>
          </div>
          {age !== null && (
            <>
              <div className="h-12 w-px bg-seam sm:h-14" aria-hidden />
              <div>
                <p className="text-xs font-medium tracking-widest text-moth uppercase">Age</p>
                <p className="mt-1.5 font-mono text-3xl tracking-tight text-linen sm:text-5xl">
                  {age.toFixed(2)}
                </p>
              </div>
            </>
          )}
        </div>
        <p className="mt-3 text-xs text-moth">
          own <span className="font-mono text-sage">{fmtINRShort(ownTotal)}</span> · owe{' '}
          <span className="font-mono text-rose">{fmtINRShort(oweTotal)}</span> · the goal is up →
        </p>
      </Link>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-seam bg-veil/50 px-4 py-3">
            <p className="font-mono text-xl text-linen">{t.value}</p>
            <p className="mt-0.5 text-xs text-moth">{t.label}</p>
            <p className="mt-1 font-mono text-[10px] text-moth/70">{t.month}</p>
          </div>
        ))}
      </section>

      {brief && (
        <details className="rounded-xl border border-seam bg-veil open:bg-veil">
          <summary className="cursor-pointer px-5 py-3 text-xs font-medium tracking-widest text-ember uppercase">
            Today&apos;s brief · {brief.day}
          </summary>
          <div className="border-l-2 border-ember mx-5 mb-4 px-4">
            <pre className="font-voice whitespace-pre-wrap text-[15px] leading-7 text-linen/95">
              {brief.content}
            </pre>
          </div>
        </details>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title="Screen time" subtitle="browsing" href="/browsing">
          <Bars days={screenDays} color="ember" fmt={(v) => fmtDuration(v)} />
        </ChartCard>
        <ChartCard title="Tasks completed" subtitle="tasks" href="/tasks">
          <Bars days={taskDays} color="sage" fmt={(v) => `${v} done`} />
        </ChartCard>
        <ChartCard title="Chapters & lessons" subtitle="learning" href="/learning">
          <Bars days={readDays} color="sage" fmt={(v) => `${v} units`} />
        </ChartCard>
        <ChartCard title="Daily spend" subtitle="finance" href="/finance">
          <Bars days={spendDays} color="ember" fmt={(v) => fmtINR(v)} />
        </ChartCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title="Where today went" subtitle="browsing" href="/browsing">
          {todayStats.domains.length === 0 ? (
            <p className="text-sm text-moth">Nothing tracked yet today.</p>
          ) : (
            <ul className="space-y-2.5">
              {todayStats.domains.slice(0, 5).map((d) => (
                <li key={d.domain} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 truncate text-moth">{d.domain}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-seam/60">
                    <div
                      className="h-full rounded-r-full bg-ember/80"
                      style={{ width: `${Math.max((d.seconds / maxDomain) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-xs text-linen/90">
                    {fmtDuration(d.seconds)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
        <ChartCard title="In progress" subtitle="learning" href="/learning">
          {activeLearning.length === 0 ? (
            <p className="text-sm text-moth">Nothing active. Pick something up.</p>
          ) : (
            <ul className="space-y-2.5">
              {activeLearning.map((l) => {
                const pct = l.unitsTotal
                  ? Math.min(100, Math.round((l.unitsDone / l.unitsTotal) * 100))
                  : null;
                return (
                  <li key={l.id} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 truncate text-moth">{l.title}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-seam/60">
                      <div
                        className="h-full rounded-r-full bg-sage"
                        style={{ width: `${pct === null ? 2 : Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right font-mono text-xs text-linen/90">
                      {pct === null ? `${l.unitsDone}` : `${pct}%`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>
      </div>
    </main>
  );
}
