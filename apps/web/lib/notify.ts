import webpush from 'web-push';
import { generateText } from 'ai';
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import {
  db,
  events,
  learning,
  notifications,
  pushSubscriptions,
  routines,
  tasks,
  transactions,
} from '@/lib/db';
import { istToday, dayOfWeek, weekMonday } from '@/lib/routines';
import { VIVY_MODEL_FAST, VIVY_PERSONA } from '@/lib/ai';
import { fmtINR } from '@/lib/finance';

// The notification engine: rules decide WHEN (cron-driven, one dedupe key per
// kind per IST day), Haiku words the nudge in Vivy's voice, delivery is web
// push to every subscribed device + the in-app bell. Channel-agnostic on
// purpose — an FCM adapter can sit next to sendPushToAll when Epic 6 lands.

export type Nudge = {
  kind: 'morning' | 'spend' | 'evening' | 'system';
  title: string;
  body: string;
  url?: string;
  dedupeKey: string;
};

export async function sendPushToAll(payload: { title: string; body: string; url?: string }) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return { sent: 0, of: 0, note: 'VAPID keys missing' };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:vivy@localhost', publicKey, privateKey);

  const subs = await db.select().from(pushSubscriptions);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // the browser revoked this subscription — forget it
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
      }
    }
  }
  return { sent, of: subs.length };
}

// Insert-once (dedupeKey) then push. Returns what happened, for cron responses.
export async function notify(n: Nudge) {
  const inserted = await db
    .insert(notifications)
    .values({ kind: n.kind, title: n.title, body: n.body, url: n.url ?? null, dedupeKey: n.dedupeKey })
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning({ id: notifications.id });
  if (inserted.length === 0) return { skipped: 'already sent today', dedupeKey: n.dedupeKey };
  const push = await sendPushToAll({ title: n.title, body: n.body, url: n.url });
  return { id: inserted[0].id, push };
}

// One short push line in Vivy's voice; falls back to the template if the model is down.
async function vivyWords(instruction: string, facts: string, fallback: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: VIVY_MODEL_FAST,
      system:
        VIVY_PERSONA +
        ' Reply with ONE push-notification body and nothing else: a single sentence or two, under 25 words total, ' +
        'plain text only — no markdown, no headings, no lists, no emoji, no quotes around it. ' +
        instruction,
      prompt: facts,
    });
    // flatten whatever came back into one plain line — models drift into markdown
    const line = text
      .replace(/^[\s>*-]+/gm, '') // list markers / blockquotes at line starts
      .replace(/[*#`]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
    return line || fallback;
  } catch {
    return fallback;
  }
}

const istDayStart = (day: string) => new Date(`${day}T00:00:00+05:30`);
const nextDay = (day: string) =>
  new Date(new Date(`${day}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);

// Morning (rides the daily-brief cron): the brief is ready — push its headline.
export async function morningNudge(briefContent: string) {
  const today = istToday();
  const body = await vivyWords(
    'Compress my morning brief into one line that names the single most important thing today.',
    briefContent,
    'Your morning brief is ready.',
  );
  return notify({ kind: 'morning', title: 'Morning brief', body, url: '/', dedupeKey: `morning:${today}` });
}

// Midday: overspend check. Today's daily (non-bill) spend vs the 30-day daily
// average — nudges only when it's both real money and clearly above pattern.
export async function middaySpendCheck() {
  const today = istToday();
  const dayStart = istDayStart(today);
  const histStart = new Date(dayStart.getTime() - 30 * 86400000);
  const dailyExpense = (extra: ReturnType<typeof gte>[]) =>
    db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.type, 'expense'), isNull(transactions.recurringId), ...extra));

  const [[todayRow], [histRow]] = await Promise.all([
    dailyExpense([gte(transactions.ts, dayStart)]),
    dailyExpense([gte(transactions.ts, histStart), lt(transactions.ts, dayStart)]),
  ]);
  const todaySpend = Number(todayRow.total);
  const avg = Number(histRow.total) / 30;

  if (todaySpend < 500 || todaySpend <= avg * 2) {
    return { skipped: `₹${todaySpend} today vs ₹${Math.round(avg)}/day average — fine` };
  }
  const body = await vivyWords(
    'I am overspending today. Say it straight with both numbers and one tiny corrective step.',
    `Spent today (non-bill): ${fmtINR(todaySpend)}. My 30-day daily average: ${fmtINR(Math.round(avg))}.`,
    `${fmtINR(todaySpend)} spent today — your daily average is ${fmtINR(Math.round(avg))}.`,
  );
  return notify({
    kind: 'spend',
    title: 'Spending check',
    body,
    url: '/finance',
    dedupeKey: `spend:${today}`,
  });
}

// Evening: the review — what got done, what's still owed, stalled books,
// tomorrow's deadlines — always ends by prompting me to line up tomorrow.
export async function eveningReview() {
  const today = istToday();
  const dayStart = istDayStart(today);
  const tomorrow = nextDay(today);
  const monday = weekMonday(today);
  const dow = dayOfWeek(today);

  const [doneToday, openRows, routineRows, weekDone, learnActive, learnLogs, [spendRow]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(tasks)
      .where(and(eq(tasks.status, 'done'), gte(tasks.completedAt, dayStart))),
    db
      .select()
      .from(tasks)
      .where(inArray(tasks.status, ['inbox', 'today', 'doing']))
      .limit(200),
    db.select().from(routines).where(eq(routines.active, true)),
    db
      .select({ payload: events.payload })
      .from(events)
      .where(and(eq(events.type, 'routine.done'), sql`${events.payload}->>'day' >= ${monday}`)),
    db.select().from(learning).where(eq(learning.status, 'active')),
    db
      .select({
        learningId: sql<string>`${events.payload}->>'learningId'`,
        last: sql<string>`max(${events.ts})`,
      })
      .from(events)
      .where(eq(events.type, 'learning.log'))
      .groupBy(sql`1`),
    db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'expense'),
          isNull(transactions.recurringId),
          gte(transactions.ts, dayStart),
        ),
      ),
  ]);

  const done = Number(doneToday[0].n);
  const leftovers = openRows.filter(
    (t) => t.status === 'today' || t.status === 'doing' || (t.due && t.due <= today),
  );
  const dueTomorrow = openRows.filter((t) => t.due === tomorrow);

  const doneDays = new Map<string, string[]>();
  for (const e of weekDone) {
    const p = e.payload as { routineId?: string; day?: string };
    if (!p.routineId || !p.day) continue;
    doneDays.set(p.routineId, [...(doneDays.get(p.routineId) ?? []), p.day]);
  }
  const routinesOwed = routineRows.filter((r) => {
    const days = doneDays.get(r.id) ?? [];
    if (days.includes(today)) return false;
    return r.daysOfWeek ? r.daysOfWeek.includes(dow) : days.length < (r.timesPerWeek ?? 0);
  });

  const lastLog = new Map(learnLogs.map((l) => [l.learningId, new Date(l.last)]));
  const stalled = learnActive
    .map((i) => {
      const last = lastLog.get(i.id);
      const days = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null;
      return days === null || days >= 5 ? { title: i.title, days } : null;
    })
    .filter((x): x is { title: string; days: number | null } => x !== null);

  const facts = [
    `Tasks completed today: ${done}.`,
    leftovers.length
      ? `Still open in today's lane: ${leftovers
          .map((t) => t.title)
          .slice(0, 5)
          .join('; ')}.`
      : '',
    dueTomorrow.length ? `Due tomorrow: ${dueTomorrow.map((t) => t.title).join('; ')}.` : '',
    routinesOwed.length ? `Routines still owed: ${routinesOwed.map((r) => r.name).join(', ')}.` : '',
    stalled.length
      ? `Stalled learning: ${stalled.map((s) => `${s.title} (${s.days === null ? 'never logged' : `${s.days} days quiet`})`).join('; ')}.`
      : '',
    `Spent today (non-bill): ${fmtINR(Number(spendRow.total))}.`,
  ]
    .filter(Boolean)
    .join('\n');

  const body = await vivyWords(
    'This is my evening review. Lead with what I completed (celebrate if earned), name the ONE thing being avoided if any, and end by telling me to open the planner and lay out tomorrow now.',
    facts,
    `${done} task(s) done today. Take 2 minutes and plan tomorrow.`,
  );
  return notify({
    kind: 'evening',
    title: 'Evening review',
    body,
    url: '/plan',
    dedupeKey: `evening:${today}`,
  });
}
