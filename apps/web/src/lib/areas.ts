import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull, ne } from 'drizzle-orm';
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
  openTasks: number;
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

    return {
      id: area.id,
      name: area.name,
      colour: area.colour,
      openTasks: open,
    };
  });
}

export async function createArea(userId: string, name: string, colour: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Give the area a name.');
  if (trimmed.length > 60) throw new Error('That name is too long.');
  if (!AREA_COLOURS.includes(colour as (typeof AREA_COLOURS)[number])) {
    throw new Error('Pick a colour from the palette.');
  }
  const sameColour = await db()
    .select({ id: areas.id })
    .from(areas)
    .where(and(eq(areas.userId, userId), eq(areas.colour, colour), isNull(areas.archivedAt)))
    .limit(1);
  if (sameColour.length > 0) throw new Error('That colour already belongs to another focus area.');

  await db()
    .insert(areas)
    .values({
      id: randomUUID(),
      userId,
      name: trimmed,
      colour,
    })
    // Names are unique per user, so re-adding one revives it rather than
    // failing with a constraint error the person cannot act on.
    .onConflictDoUpdate({
      target: [areas.userId, areas.name],
      set: { colour, archivedAt: null, updatedAt: new Date() },
    });
}

export async function updateArea(
  userId: string,
  areaId: string,
  patch: { name?: string; colour?: string },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error('Give the area a name.');
    set['name'] = trimmed;
  }
  if (patch.colour !== undefined) {
    if (!AREA_COLOURS.includes(patch.colour as (typeof AREA_COLOURS)[number])) {
      throw new Error('Pick a colour from the palette.');
    }
    const sameColour = await db()
      .select({ id: areas.id })
      .from(areas)
      .where(
        and(
          eq(areas.userId, userId),
          eq(areas.colour, patch.colour),
          isNull(areas.archivedAt),
          ne(areas.id, areaId),
        ),
      )
      .limit(1);
    if (sameColour.length > 0) {
      throw new Error('That colour already belongs to another focus area.');
    }
    set['colour'] = patch.colour;
  }
  await db()
    .update(areas)
    .set(set)
    .where(and(eq(areas.id, areaId), eq(areas.userId, userId)));
}

/**
 * Archive without deleting.
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

export async function deleteAreaPermanently(userId: string, areaId: string): Promise<void> {
  await db().transaction(async (transaction) => {
    await transaction
      .update(tasks)
      .set({ areaId: null, updatedAt: new Date() })
      .where(and(eq(tasks.userId, userId), eq(tasks.areaId, areaId)));

    await transaction
      .delete(areas)
      .where(and(eq(areas.id, areaId), eq(areas.userId, userId)));
  });
}
