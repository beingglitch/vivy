import { and, eq, gte, sql } from 'drizzle-orm';
import { db, events, goals, learning, positions } from '@/lib/db';
import { fmtINRShort } from '@/lib/finance';
import { weekMonday, istToday } from '@/lib/routines';

export type Goal = typeof goals.$inferSelect;

// Every metric is a reading computed from data the timeline already has — goals
// never have a manual progress field (automation rule). Adding a metric = one entry.
export const METRICS = {
  networth: { label: 'liquid net worth', unit: 'INR' },
  books_finished: { label: 'books finished', unit: 'books' },
  learning_units_week: { label: 'learning units this week', unit: 'units/wk' },
} as const;
export type MetricKey = keyof typeof METRICS;

export const GOAL_KINDS = ['money', 'reading', 'health', 'custom'] as const;

// Which metrics make sense for which kind (UI hint; health has none until
// meal/sleep events exist — SPEC-0011).
export const KIND_METRICS: Record<string, MetricKey[]> = {
  money: ['networth'],
  reading: ['books_finished', 'learning_units_week'],
  health: [],
  custom: ['networth', 'books_finished', 'learning_units_week'],
};

export async function readMetric(metric: MetricKey): Promise<number> {
  if (metric === 'networth') {
    const rows = await db.select().from(positions).where(eq(positions.consider, true));
    return rows.reduce((s, p) => s + (p.kind === 'asset' ? 1 : -1) * Number(p.value), 0);
  }
  if (metric === 'books_finished') {
    const rows = await db
      .select({ n: sql<number>`count(*)` })
      .from(learning)
      .where(and(eq(learning.kind, 'book'), eq(learning.status, 'done')));
    return Number(rows[0]?.n ?? 0);
  }
  // learning_units_week: units logged since Monday (IST week, same as routines)
  const mondayStart = new Date(weekMonday(istToday()) + 'T00:00:00+05:30');
  const rows = await db
    .select({ n: sql<number>`coalesce(sum((payload->>'units')::numeric), 0)` })
    .from(events)
    .where(and(eq(events.type, 'learning.log'), gte(events.ts, mondayStart)));
  return Number(rows[0]?.n ?? 0);
}

export type GoalProgress = {
  goal: Goal;
  current: number | null; // null = no auto metric (custom/health without data)
  fraction: number | null; // 0..1 of the distance covered
  timeFraction: number | null; // 0..1 of the time elapsed
  onPace: boolean | null;
  line: string; // human line, used by UI and by the AI context
};

function fmtVal(metric: MetricKey | null, v: number): string {
  if (metric === 'networth') return fmtINRShort(v);
  return String(Math.round(v * 10) / 10);
}

export async function goalProgress(g: Goal): Promise<GoalProgress> {
  const metric = (g.metric as MetricKey | null) && g.metric! in METRICS ? (g.metric as MetricKey) : null;
  const current = metric ? await readMetric(metric) : null;

  let fraction: number | null = null;
  let timeFraction: number | null = null;
  let onPace: boolean | null = null;

  const target = g.target === null ? null : Number(g.target);
  const start = g.startValue === null ? Number.NaN : Number(g.startValue);

  if (current !== null && target !== null && !Number.isNaN(start) && target !== start) {
    fraction = Math.max(0, Math.min(1, (current - start) / (target - start)));
  }
  if (g.deadline) {
    const t0 = new Date(g.createdAt).getTime();
    const t1 = new Date(g.deadline + 'T23:59:59+05:30').getTime();
    if (t1 > t0) timeFraction = Math.max(0, Math.min(1, (Date.now() - t0) / (t1 - t0)));
  }
  if (fraction !== null && timeFraction !== null) onPace = fraction >= timeFraction;

  let line = g.title;
  if (current !== null && target !== null) {
    line = `${g.title}: ${fmtVal(metric, current)} of ${fmtVal(metric, target)}`;
    if (g.deadline) line += ` by ${g.deadline}`;
    if (onPace !== null) {
      if (onPace) line += ' — on pace';
      else {
        // what the pace demands per remaining month
        const monthsLeft = Math.max(
          1 / 30,
          (new Date(g.deadline + 'T00:00:00+05:30').getTime() - Date.now()) / (30 * 86400000),
        );
        const perMonth = (target - current) / monthsLeft;
        line += ` — behind; needs ${metric === 'networth' ? '+' + fmtINRShort(perMonth) : '+' + fmtVal(metric, perMonth)}/month`;
      }
    }
  } else if (metric === null) {
    line = `${g.title} (no auto metric yet${g.kind === 'health' ? ' — waiting for health data' : ''})`;
  }

  return { goal: g, current, fraction, timeFraction, onPace, line };
}

export async function activeGoalsProgress(): Promise<GoalProgress[]> {
  const rows = await db.select().from(goals).where(eq(goals.status, 'active')).orderBy(goals.createdAt);
  return Promise.all(rows.map(goalProgress));
}

// One block for AI prompts (brief, planner).
export async function goalsContext(): Promise<string> {
  const gp = await activeGoalsProgress();
  if (!gp.length) return '';
  return '\nGoals (auto-measured):\n' + gp.map((p) => `- ${p.line}`).join('\n');
}
