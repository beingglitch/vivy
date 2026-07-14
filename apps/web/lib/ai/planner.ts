import { generateObject } from 'ai';
import { z } from 'zod';
import { and, eq, inArray, lte } from 'drizzle-orm';
import { db, plans, tasks } from '@/lib/db';
import { istToday } from '@/lib/routines';
import { goalsContext } from '@/lib/goals';
import { googleConnection, listEvents, type CalEvent } from '@/lib/google';
import { VIVY_MODEL, VIVY_PERSONA, memoryContext } from './index';
import { structureContext } from './daily-brief';

export function istTomorrow(): string {
  const d = new Date(`${istToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type PlanContext = {
  day: string;
  calendar: CalEvent[] | null; // null = Google not connected
  fixed: string; // text block for the model and the /plan page
  existing: typeof plans.$inferSelect | null;
};

// Everything already true about tomorrow, before Suraj says what he wants.
export async function planContext(): Promise<PlanContext> {
  const day = istTomorrow();

  const [conn, structure, goalLines, dueTasks, existingRows] = await Promise.all([
    googleConnection(),
    structureContext(),
    goalsContext(),
    db
      .select()
      .from(tasks)
      .where(and(inArray(tasks.status, ['inbox', 'today', 'doing']), lte(tasks.due, day)))
      .orderBy(tasks.priority)
      .limit(30),
    db.select().from(plans).where(eq(plans.day, day)),
  ]);

  let calendar: CalEvent[] | null = null;
  if (conn) {
    try {
      calendar = await listEvents(day);
    } catch (e) {
      console.error('planner: calendar fetch failed', e);
    }
  }

  const fixed = [
    `Planning for: ${day}`,
    calendar === null
      ? 'Calendar: not connected.'
      : calendar.length
        ? 'Already on the calendar (immovable):\n' +
          calendar
            .map(
              (e) =>
                `- ${e.allDay ? 'all day' : `${e.start.slice(11, 16)}–${e.end.slice(11, 16)}`} ${e.title}`,
            )
            .join('\n')
        : 'Calendar: empty tomorrow.',
    dueTasks.length
      ? 'Tasks due by tomorrow:\n' +
        dueTasks.map((t) => `- ${t.title} (due ${t.due}, p${t.priority})`).join('\n')
      : '',
    structure,
    goalLines,
  ]
    .filter(Boolean)
    .join('\n\n');

  return { day, calendar, fixed, existing: existingRows[0] ?? null };
}

const planSchema = z.object({
  content: z
    .string()
    .describe('The plan as markdown: a short opening line, then the schedule, then one coaching note.'),
  blocks: z
    .array(
      z.object({
        start: z.string().describe('HH:MM 24h IST'),
        end: z.string().describe('HH:MM 24h IST'),
        title: z.string().describe('short block title, no [vivy] prefix'),
      }),
    )
    .describe('Only the NEW work blocks Vivy proposes — never the existing calendar events.'),
});

export async function generatePlan(intent: string): Promise<typeof plans.$inferSelect> {
  const ctx = await planContext();
  const memory = await memoryContext();

  const { object } = await generateObject({
    model: VIVY_MODEL,
    schema: planSchema,
    system:
      VIVY_PERSONA +
      ' Suraj tells you tonight what tomorrow should be; you lay out the day. Rules: ' +
      'never move or overlap existing calendar events; leave meal gaps; no blocks before 08:00 or after 23:30 IST; ' +
      'prefer 45–120 min focus blocks; if a goal is behind pace, place a block that serves it and say why; ' +
      'if he asks for too much, cut honestly and say what you cut. Blocks must match the schedule in the markdown.' +
      memory,
    prompt: `${ctx.fixed}\n\nWhat Suraj wants tomorrow:\n${intent || '(he gave no specifics — plan from tasks, routines and goals)'}`,
  });

  const [row] = await db
    .insert(plans)
    .values({ day: ctx.day, intent: intent || null, content: object.content, blocks: object.blocks })
    .onConflictDoUpdate({
      target: plans.day,
      // replanning replaces the plan but keeps calendarEventIds so the old
      // [vivy] blocks can still be found and replaced on confirm
      set: { intent: intent || null, content: object.content, blocks: object.blocks },
    })
    .returning();
  return row;
}

// Morning-brief context: today's plan, if one was made last night.
export async function todaysPlanContext(): Promise<string> {
  const rows = await db.select().from(plans).where(eq(plans.day, istToday()));
  const p = rows[0];
  if (!p) return '';
  return `\nLast night's plan for today (hold me to it):\n${p.content}`;
}
