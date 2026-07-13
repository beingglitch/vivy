import { eq, sql } from 'drizzle-orm';
import { db, events, learning } from './db';

// One reading/course session: bump the cached counter, activate if new,
// auto-finish when the total is reached, and drop a learning.log event on
// the timeline (that's what the daily brief / coach reads).
export async function logLearningProgress(
  id: string,
  units: number,
  note: string | null,
  source: string, // 'manual' | 'chat'
) {
  const today = new Date().toISOString().slice(0, 10);
  const [item] = await db
    .update(learning)
    .set({
      unitsDone: sql`${learning.unitsDone} + ${units}`,
      status: sql`case when ${learning.status} = 'backlog' then 'active' else ${learning.status} end`,
      startedAt: sql`coalesce(${learning.startedAt}, ${today})`,
    })
    .where(eq(learning.id, id))
    .returning();
  if (!item) return null;

  if (item.unitsTotal && item.unitsDone >= item.unitsTotal && item.status !== 'done') {
    const [finished] = await db
      .update(learning)
      .set({ status: 'done', finishedAt: today })
      .where(eq(learning.id, id))
      .returning();
    if (finished) Object.assign(item, finished);
  }

  await db.insert(events).values({
    source,
    type: 'learning.log',
    title: `${item.kind === 'book' ? 'Read' : 'Did'} ${units} ${item.unitName}${units === 1 ? '' : 's'} — ${item.title}`,
    payload: { learningId: item.id, kind: item.kind, title: item.title, units, note },
    processed: true, // it IS the derived record; nothing to extract
  });

  return item;
}
