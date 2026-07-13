import { generateText } from 'ai';
import { and, desc, eq, gte, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { db, briefs, events, learning, projects, routines, tasks, transactions } from '@/lib/db';
import { browsingStats, fmtDuration } from '@/lib/browsing';
import { istToday, dayOfWeek, weekMonday } from '@/lib/routines';
import { VIVY_MODEL, VIVY_PERSONA, memoryContext } from './index';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Routines due today (with weekly progress) + active areas/projects gone quiet —
// the shape of the task world, so the brief can nag about silence, not just items.
async function structureContext(): Promise<string> {
  const today = istToday();
  const monday = weekMonday(today);
  const dow = dayOfWeek(today);

  const [routineRows, doneEvents, projectRows, moves] = await Promise.all([
    db.select().from(routines).where(eq(routines.active, true)).limit(100),
    db
      .select({ payload: events.payload })
      .from(events)
      .where(and(eq(events.type, 'routine.done'), sql`${events.payload}->>'day' >= ${monday}`)),
    db.select().from(projects).where(eq(projects.status, 'active')).limit(100),
    db
      .select({
        projectId: tasks.projectId,
        open: sql<number>`count(*) filter (where ${tasks.status} in ('inbox','today','doing'))`,
        last: sql<string>`max(greatest(${tasks.createdAt}, coalesce(${tasks.completedAt}, ${tasks.createdAt})))`,
      })
      .from(tasks)
      .where(isNotNull(tasks.projectId))
      .groupBy(tasks.projectId),
  ]);
  if (routineRows.length === 0 && projectRows.length === 0) return '';

  const doneByRoutine = new Map<string, string[]>();
  for (const e of doneEvents) {
    const p = e.payload as { routineId?: string; day?: string };
    if (!p.routineId || !p.day) continue;
    doneByRoutine.set(p.routineId, [...(doneByRoutine.get(p.routineId) ?? []), p.day]);
  }

  const routineLines = routineRows
    .map((r) => {
      const days = doneByRoutine.get(r.id) ?? [];
      if (days.includes(today)) return `- ${r.name}: done today ✓`;
      if (r.daysOfWeek) {
        return r.daysOfWeek.includes(dow)
          ? `- ${r.name}: due today (${r.daysOfWeek.map((d) => DAY_NAMES[d]).join('/')})`
          : null;
      }
      const target = r.timesPerWeek ?? 0;
      return days.length < target ? `- ${r.name}: ${days.length} of ${target} this week` : null;
    })
    .filter(Boolean);

  const moveByProject = new Map(moves.map((m) => [m.projectId!, m]));
  const quiet = projectRows
    .map((p) => {
      const m = moveByProject.get(p.id);
      if (!m) return `- ${p.name} (${p.kind}): no tasks yet`;
      const daysQuiet = Math.floor((Date.now() - new Date(m.last).getTime()) / 86400000);
      return daysQuiet >= 5
        ? `- ${p.name} (${p.kind}): nothing moved for ${daysQuiet} days, ${m.open} open`
        : null;
    })
    .filter(Boolean);

  return (
    (routineLines.length ? `\nRoutines needing attention today:\n${routineLines.join('\n')}` : '') +
    (quiet.length ? `\nQuiet areas/projects (call these out):\n${quiet.join('\n')}` : '')
  );
}

// Books/courses with days-since-last-log — the reading coach's raw material.
async function learningContext(): Promise<string> {
  const items = await db
    .select()
    .from(learning)
    .where(ne(learning.status, 'dropped'))
    .orderBy(desc(learning.createdAt))
    .limit(100);
  if (items.length === 0) return '';

  const lastLogs = await db
    .select({
      learningId: sql<string>`${events.payload}->>'learningId'`,
      last: sql<string>`max(${events.ts})`,
    })
    .from(events)
    .where(eq(events.type, 'learning.log'))
    .groupBy(sql`1`);
  const lastById = new Map(lastLogs.map((l) => [l.learningId, new Date(l.last)]));

  const active = items.filter((i) => i.status === 'active');
  const backlog = items.filter((i) => i.status === 'backlog');
  const lines = active.map((i) => {
    const last = lastById.get(i.id);
    const days = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null;
    return (
      `- [${i.kind}] ${i.title}: ${i.unitsDone}${i.unitsTotal ? '/' + i.unitsTotal : ''} ${i.unitName}s, ` +
      (i.startedAt ? `started ${i.startedAt}, ` : '') +
      (days === null
        ? 'no session logged yet'
        : days === 0
          ? 'logged today'
          : `last session ${days} day(s) ago`)
    );
  });
  return (
    `\nLearning (${active.length} active, ${backlog.length} in backlog):\n` +
    (lines.length ? lines.join('\n') : '(nothing active)') +
    (backlog.length > 3
      ? `\n(backlog has ${backlog.length} unstarted items — watch for over-collecting)`
      : '')
  );
}

// Yesterday's spend + 7-day category totals.
async function spendContext(): Promise<string> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const yesterday = new Date(dayStart.getTime() - 86400000);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [yday, week] = await Promise.all([
    db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          gte(transactions.ts, yesterday),
          eq(transactions.type, 'expense'),
          sql`${transactions.ts} < ${dayStart}`,
        ),
      ),
    db
      .select({ category: transactions.category, total: sql<string>`sum(${transactions.amount})` })
      .from(transactions)
      .where(and(gte(transactions.ts, weekAgo), eq(transactions.type, 'expense')))
      .groupBy(transactions.category)
      .orderBy(sql`2 desc`),
  ]);
  if (week.length === 0) return '';

  const weekTotal = week.reduce((s, c) => s + Number(c.total), 0);
  return (
    `\nSpending: ₹${Number(yday[0]?.total ?? 0)} yesterday; last 7 days ₹${weekTotal} ` +
    `(${week.map((c) => `${c.category} ₹${Number(c.total)}`).join(', ')})`
  );
}

// Per-day numbers for the last 7 days — the raw material for honest coaching
// (streaks, inconsistency, slowdowns need more than one day to be visible).
async function weeklyTrend(): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [browse, done] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${events.ts}, 'YYYY-MM-DD')`,
        seconds: sql<number>`coalesce(sum((${events.payload}->>'seconds')::numeric), 0)`,
        videoSeconds: sql<number>`coalesce(sum((${events.payload}->>'seconds')::numeric) filter (where ${events.type} = 'video.watch'), 0)`,
      })
      .from(events)
      .where(and(gte(events.ts, weekAgo), sql`${events.source} = 'browser'`))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({
        day: sql<string>`to_char(${tasks.completedAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`,
      })
      .from(tasks)
      .where(and(gte(tasks.completedAt, weekAgo), inArray(tasks.status, ['done'])))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);

  if (browse.length === 0 && done.length === 0) return '';

  const doneByDay = new Map(done.map((d) => [d.day, Number(d.count)]));
  const lines = browse.map(
    (b) =>
      `- ${b.day}: ${fmtDuration(Number(b.seconds))} screen time ` +
      `(${fmtDuration(Number(b.videoSeconds))} video), ` +
      `${doneByDay.get(b.day) ?? 0} tasks completed`,
  );
  for (const d of done) {
    if (!browse.some((b) => b.day === d.day)) {
      lines.push(`- ${d.day}: (no browsing data), ${d.count} tasks completed`);
    }
  }
  return `\nLast 7 days, day by day:\n${lines.sort().join('\n')}`;
}

function fmtTask(t: typeof tasks.$inferSelect): string {
  const bits = [
    `- ${t.title}`,
    `(priority ${t.priority}`,
    t.due ? `· due ${t.due}` : '',
    t.aiProposed ? '· AI-proposed, not yet approved' : '',
    ')',
  ];
  return bits.filter(Boolean).join(' ') + (t.detail ? ` — ${t.detail}` : '');
}

// The Jarvis moment: read everything, decide the plan, write one brief per day.
export async function generateDailyBrief(): Promise<{ day: string; content: string }> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const yesterday = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
  const day = new Date().toISOString().slice(0, 10);

  const [open, doneYesterday, stats, memory, trend, learn, spend, structure] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(inArray(tasks.status, ['inbox', 'today', 'doing']))
      .orderBy(tasks.priority, desc(tasks.createdAt))
      .limit(60),
    db
      .select()
      .from(tasks)
      .where(and(inArray(tasks.status, ['done']), gte(tasks.completedAt, yesterday)))
      .limit(30),
    browsingStats(yesterday),
    memoryContext(),
    weeklyTrend(),
    learningContext(),
    spendContext(),
    structureContext(),
  ]);

  const context = [
    `Today: ${day}`,
    `\nOpen tasks (${open.length}):`,
    open.length ? open.map(fmtTask).join('\n') : '(none)',
    `\nCompleted since yesterday (${doneYesterday.length}):`,
    doneYesterday.length ? doneYesterday.map((t) => `- ${t.title}`).join('\n') : '(none)',
    `\nYesterday's screen time: ${fmtDuration(stats.totalBrowseSeconds)} browsing, ` +
      `${fmtDuration(stats.totalVideoSeconds)} video across ${stats.videos.length} videos.`,
    stats.searches.length
      ? `Recent searches: ${stats.searches
          .slice(0, 15)
          .map((s) => `"${s.query}"`)
          .join(', ')}`
      : '',
    stats.videoTypes.length
      ? `Video time by type (24h): ${stats.videoTypes.map((t) => `${t.category} ${fmtDuration(t.seconds)}`).join(', ')}`
      : '',
    trend,
    learn,
    spend,
    structure,
  ]
    .filter(Boolean)
    .join('\n');

  const { text } = await generateText({
    model: VIVY_MODEL,
    system:
      VIVY_PERSONA +
      ' Write my MORNING BRIEF in markdown. Sections: ' +
      '**Top 3 today** (the must-dos, ranked, one-line why each — deadlines and priority 1 first), ' +
      '**Also on the list** (the rest worth touching, compressed), ' +
      '**Note from Vivy** (your coach moment: ONE honest observation from the data — a streak to protect, ' +
      'a slowdown, a stalled book/course (days since last session), unusual spending, an overdue item I keep dodging, ' +
      'a routine behind its weekly target, an area or project gone quiet for days — ' +
      'with the numbers that prove it and one tiny concrete next step). ' +
      'If there are AI-proposed tasks awaiting approval, remind me to review them. ' +
      'Under 250 words. No preamble — start with the first section.' +
      memory,
    prompt: context,
  });

  const [row] = await db
    .insert(briefs)
    .values({ day, content: text })
    .onConflictDoUpdate({ target: briefs.day, set: { content: text } })
    .returning();

  return { day: row.day, content: row.content };
}
