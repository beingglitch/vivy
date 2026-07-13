import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db, events, routines } from '@/lib/db';
import { istToday } from '@/lib/routines';

// Toggle today's completion for a routine. Done = a `routine.done` event on the
// timeline (payload: { routineId, day }); tapping again the same day removes it.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [routine] = await db.select().from(routines).where(eq(routines.id, id)).limit(1);
  if (!routine) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const day = istToday();
  const existing = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.type, 'routine.done'),
        sql`${events.payload}->>'routineId' = ${id}`,
        sql`${events.payload}->>'day' = ${day}`,
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db.delete(events).where(eq(events.id, existing[0].id));
    return NextResponse.json({ done: false, day });
  }

  await db.insert(events).values({
    source: 'manual',
    type: 'routine.done',
    title: routine.name,
    payload: { routineId: id, day },
  });
  return NextResponse.json({ done: true, day });
}
