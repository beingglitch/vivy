import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db, events } from '@/lib/db';
import { istToday } from '@/lib/routines';

// Health = events like everything else. Meals and sleep can't be sensed, so
// voice/chat capture IS the designed flow here (not a debug fallback); sleep
// inference from phone.usage gaps can replace the sleep half later.

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

export async function logMeal(meal: Meal, source: string, note?: string) {
  const day = istToday();
  const [row] = await db
    .insert(events)
    .values({
      source,
      type: 'meal.logged',
      title: `${meal} logged`,
      payload: { meal, day, ...(note ? { note } : {}) },
      processed: true, // it IS the record; nothing to extract
    })
    .returning({ id: events.id });
  return { id: row.id, meal, day };
}

export async function logSleep(kind: 'sleep' | 'wake', source: string) {
  const day = istToday();
  const [row] = await db
    .insert(events)
    .values({
      source,
      type: kind === 'sleep' ? 'sleep.start' : 'sleep.wake',
      title: kind === 'sleep' ? 'going to sleep' : 'woke up',
      payload: { day },
      processed: true,
    })
    .returning({ id: events.id });
  return { id: row.id, kind, day };
}

export type HealthToday = {
  meals: Meal[]; // distinct meals logged today (IST)
  asleep: boolean; // last sleep event is sleep.start with no wake after it
  lastNightHours: number | null; // wake ts − preceding sleep.start, if within 16h
};

export async function healthToday(): Promise<HealthToday> {
  const day = istToday();
  const since = new Date(Date.now() - 40 * 3600_000); // covers yesterday's bedtime

  const [mealRows, sleepRows] = await Promise.all([
    db
      .select({ meal: sql<string>`${events.payload}->>'meal'` })
      .from(events)
      .where(and(eq(events.type, 'meal.logged'), sql`${events.payload}->>'day' = ${day}`)),
    db
      .select({ type: events.type, ts: events.ts })
      .from(events)
      .where(and(inArray(events.type, ['sleep.start', 'sleep.wake']), gte(events.ts, since)))
      .orderBy(desc(events.ts))
      .limit(10),
  ]);

  const meals = [...new Set(mealRows.map((r) => r.meal))].filter((m): m is Meal =>
    (MEALS as readonly string[]).includes(m),
  );

  const latest = sleepRows[0];
  const asleep = latest?.type === 'sleep.start';

  let lastNightHours: number | null = null;
  const wake = sleepRows.find((r) => r.type === 'sleep.wake');
  if (wake) {
    const start = sleepRows.find((r) => r.type === 'sleep.start' && r.ts < wake.ts);
    if (start) {
      const h = (wake.ts.getTime() - start.ts.getTime()) / 3600_000;
      if (h > 0 && h <= 16) lastNightHours = Math.round(h * 10) / 10;
    }
  }

  return { meals, asleep, lastNightHours };
}

// One block for AI prompts (brief, evening review). Empty string when he has
// never logged health events — no point nagging about a feature unused.
export async function healthContext(): Promise<string> {
  const h = await healthToday();
  if (h.meals.length === 0 && h.lastNightHours === null && !h.asleep) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(events)
      .where(inArray(events.type, ['meal.logged', 'sleep.start', 'sleep.wake']));
    if (Number(n) === 0) return '';
  }
  const lines = [
    `Meals logged today: ${h.meals.length ? h.meals.join(', ') : 'none yet'}.`,
    h.lastNightHours !== null ? `Last night's sleep: ${h.lastNightHours}h.` : '',
    h.asleep ? 'Last sleep event: went to sleep (no wake logged yet).' : '',
  ].filter(Boolean);
  return '\nHealth (from logged events):\n' + lines.join('\n');
}
