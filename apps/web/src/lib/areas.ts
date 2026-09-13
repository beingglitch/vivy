import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { areas, db, tasks } from '@vivy/db';
import { AREA_COLOURS } from './area-colours';

/**
 * Focus areas.
 *
 * Small enough that everything is one query. An account has a handful of these,
 * not thousands, so paging would be ceremony.
 */

export interface Area {
  id: string;
  name: string;
  colour: string;
  cadenceDays: number | null;
  openTasks: number;
  /** Days since the most recent task here was completed. Null if never. */
  lastDoneDaysAgo: number | null;
  /** True when a cadence exists and nothing has happened within it. */
  cold: boolean;
}

export async function listAreas(userId: string): Promise<Area[]> {
  const rows = await db()
    .select()
    .from(areas)
    .where(and(eq(areas.userId, userId), isNull(areas.archivedAt)))
    .orderBy(asc(areas.createdAt));

  if (rows.length === 0) return [];

  // One pass over this user's tasks rather than two queries per area.
  const theirTasks = await db().select().from(tasks).where(eq(tasks.userId, userId));

  return rows.map((area) => {
    const mine = theirTasks.filter((t) => t.areaId === area.id);
    const open = mine.filter((t) => t.status === 'open').length;

    const lastDone = mine
      .filter((t) => t.completedAt)
      .map((t) => t.completedAt as Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const daysAgo = lastDone
      ? Math.floor((Date.now() - lastDone.getTime()) / 86_400_000)
      : null;

    return {
      id: area.id,
      name: area.name,
      colour: area.colour,
      cadenceDays: area.cadenceDays,
      openTasks: open,
      lastDoneDaysAgo: daysAgo,
      // Never having finished anything counts as cold once a cadence is set:
      // an area that has produced nothing is exactly what this should catch.
      cold:
        area.cadenceDays !== null && (daysAgo === null || daysAgo > area.cadenceDays),
    };
  });
}

export async function createArea(
  userId: string,
  name: string,
  colour: string,
  cadenceDays: number | null,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Give the area a name.');
  if (trimmed.length > 60) throw new Error('That name is too long.');
  if (!AREA_COLOURS.includes(colour as (typeof AREA_COLOURS)[number])) {
    throw new Error('Pick a colour from the palette.');
  }

  await db()
    .insert(areas)
    .values({
      id: randomUUID(),
      userId,
      name: trimmed,
      colour,
      cadenceDays,
    })
    // Names are unique per user, so re-adding one revives it rather than
    // failing with a constraint error the person cannot act on.
    .onConflictDoUpdate({
      target: [areas.userId, areas.name],
      set: { colour, cadenceDays, archivedAt: null, updatedAt: new Date() },
    });
}

export async function updateArea(
  userId: string,
  areaId: string,
  patch: { name?: string; colour?: string; cadenceDays?: number | null },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error('Give the area a name.');
    set['name'] = trimmed;
  }
  if (patch.colour !== undefined) set['colour'] = patch.colour;
  if (patch.cadenceDays !== undefined) set['cadenceDays'] = patch.cadenceDays;

  await db()
    .update(areas)
    .set(set)
    .where(and(eq(areas.id, areaId), eq(areas.userId, userId)));
}

/**
 * Archive, never delete.
 *
 * Tasks keep pointing at the area, so a finished task still says which area it
 * belonged to. Deleting the row would leave those reading as unfiled.
 */
export async function archiveArea(userId: string, areaId: string): Promise<void> {
  await db()
    .update(areas)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(areas.id, areaId), eq(areas.userId, userId)));
}
