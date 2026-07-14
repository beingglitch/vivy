import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, plans } from '@/lib/db';
import { createBlocks, deleteBlocks, googleConnection } from '@/lib/google';
import { istTomorrow } from '@/lib/ai/planner';

// Put tomorrow's plan blocks on the real calendar as [vivy] events.
// Replan + confirm again = old [vivy] blocks replaced, never duplicated.
export async function POST() {
  if (!(await googleConnection())) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
  }
  const day = istTomorrow();
  const rows = await db.select().from(plans).where(eq(plans.day, day));
  const plan = rows[0];
  if (!plan?.blocks?.length) {
    return NextResponse.json(
      { error: 'no plan blocks for tomorrow — generate a plan first' },
      { status: 400 },
    );
  }

  if (plan.calendarEventIds?.length) await deleteBlocks(plan.calendarEventIds);
  const ids = await createBlocks(day, plan.blocks);
  await db.update(plans).set({ calendarEventIds: ids }).where(eq(plans.id, plan.id));
  return NextResponse.json({ ok: true, created: ids.length });
}
