import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
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
  showOnHome: boolean;
  openTasks: number;
  totalTasks: number;
  archivedAt: Date | null;
}

export async function listAreas(userId: string): Promise<Area[]> {
  const rows = await db()
    .select()
    .from(areas)
    .where(and(eq(areas.userId, userId), isNull(areas.archivedAt)))
    .orderBy(asc(areas.sortOrder), asc(areas.createdAt));

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
      cadenceDays: area.cadenceDays,
      showOnHome: area.showOnHome,
      openTasks: open,
      totalTasks: mine.length,
      archivedAt: area.archivedAt,
    };
  });
}

export async function listAllAreas(userId: string): Promise<Area[]> {
  const rows = await db()
    .select()
    .from(areas)
    .where(eq(areas.userId, userId))
    .orderBy(asc(areas.sortOrder), asc(areas.createdAt));

  if (rows.length === 0) return [];
  const theirTasks = await db().select().from(tasks).where(eq(tasks.userId, userId));

  return rows.map((area) => {
    const mine = theirTasks.filter((task) => task.areaId === area.id);
    return {
      id: area.id,
      name: area.name,
      colour: area.colour,
      cadenceDays: area.cadenceDays,
      showOnHome: area.showOnHome,
      openTasks: mine.filter((task) => task.status === 'open').length,
      totalTasks: mine.length,
      archivedAt: area.archivedAt,
    };
  });
}

export async function createArea(
  userId: string,
  name: string,
  colour: string,
  cadenceDays: number,
  showOnHome: boolean,
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Give the area a name.');
  if (trimmed.length > 60) throw new Error('That name is too long.');
  if (!AREA_COLOURS.includes(colour as (typeof AREA_COLOURS)[number])) {
    throw new Error('Pick a colour from the palette.');
  }
  if (![1, 7, 30].includes(cadenceDays)) throw new Error('Pick a cadence.');
  const sameColour = await db()
    .select({ id: areas.id })
    .from(areas)
    .where(and(eq(areas.userId, userId), eq(areas.colour, colour), isNull(areas.archivedAt)))
    .limit(1);
  if (sameColour.length > 0) throw new Error('That colour already belongs to another focus area.');

  const [lastArea] = await db()
    .select({ sortOrder: areas.sortOrder })
    .from(areas)
    .where(eq(areas.userId, userId))
    .orderBy(desc(areas.sortOrder))
    .limit(1);
  const sortOrder = (lastArea?.sortOrder ?? -1) + 1;

  const id = randomUUID();
  const [saved] = await db()
    .insert(areas)
    .values({
      id,
      userId,
      name: trimmed,
      colour,
      cadenceDays,
      showOnHome,
      sortOrder,
    })
    // Names are unique per user, so re-adding one revives it rather than
    // failing with a constraint error the person cannot act on.
    .onConflictDoUpdate({
      target: [areas.userId, areas.name],
      set: { colour, cadenceDays, showOnHome, sortOrder, archivedAt: null, updatedAt: new Date() },
    })
    .returning({ id: areas.id });
  return saved?.id ?? id;
}

export async function reorderAreas(userId: string, areaIds: string[]): Promise<void> {
  if (new Set(areaIds).size !== areaIds.length) throw new Error('Area order contains duplicates.');

  await db().transaction(async (transaction) => {
    const ownedAreas = await transaction
      .select({ id: areas.id })
      .from(areas)
      .where(eq(areas.userId, userId));
    const ownedIds = new Set(ownedAreas.map((area) => area.id));
    if (areaIds.length !== ownedIds.size || areaIds.some((id) => !ownedIds.has(id))) {
      throw new Error('Area order is incomplete.');
    }

    for (const [sortOrder, areaId] of areaIds.entries()) {
      await transaction
        .update(areas)
        .set({ sortOrder, updatedAt: new Date() })
        .where(and(eq(areas.id, areaId), eq(areas.userId, userId)));
    }
  });
}

export async function updateArea(
  userId: string,
  areaId: string,
  patch: { name?: string; colour?: string; cadenceDays?: number; showOnHome?: boolean },
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
  if (patch.cadenceDays !== undefined) {
    if (![1, 7, 30].includes(patch.cadenceDays)) throw new Error('Pick a cadence.');
    set['cadenceDays'] = patch.cadenceDays;
  }
  if (patch.showOnHome !== undefined) set['showOnHome'] = patch.showOnHome;
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
export async function archiveArea(
  userId: string,
  areaId: string,
  moveOpenTasksTo?: string | null,
): Promise<void> {
  await db().transaction(async (transaction) => {
    if (moveOpenTasksTo !== undefined) {
      if (moveOpenTasksTo) {
        const [target] = await transaction
          .select({ id: areas.id })
          .from(areas)
          .where(
            and(
              eq(areas.id, moveOpenTasksTo),
              eq(areas.userId, userId),
              isNull(areas.archivedAt),
              ne(areas.id, areaId),
            ),
          )
          .limit(1);
        if (!target) throw new Error('Choose an active focus area.');
      }
      await transaction
        .update(tasks)
        .set({ areaId: moveOpenTasksTo, updatedAt: new Date() })
        .where(and(eq(tasks.userId, userId), eq(tasks.areaId, areaId), eq(tasks.status, 'open')));
    }

    await transaction
      .update(areas)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(areas.id, areaId), eq(areas.userId, userId)));
  });
}

export async function restoreArea(userId: string, areaId: string): Promise<void> {
  const [area] = await db()
    .select({ colour: areas.colour })
    .from(areas)
    .where(and(eq(areas.id, areaId), eq(areas.userId, userId)))
    .limit(1);
  if (!area) throw new Error('Focus area not found.');

  const activeColours = await db()
    .select({ colour: areas.colour })
    .from(areas)
    .where(and(eq(areas.userId, userId), isNull(areas.archivedAt), ne(areas.id, areaId)));
  const usedColours = new Set(activeColours.map((entry) => entry.colour));
  const colour = usedColours.has(area.colour)
    ? AREA_COLOURS.find((option) => !usedColours.has(option))
    : area.colour;
  if (!colour) throw new Error('No unused focus area colour is available.');

  await db()
    .update(areas)
    .set({ colour, archivedAt: null, updatedAt: new Date() })
    .where(and(eq(areas.id, areaId), eq(areas.userId, userId)));
}

export async function deleteAreaPermanently(
  userId: string,
  areaId: string,
  moveOpenTasksTo: string | null = null,
): Promise<void> {
  await db().transaction(async (transaction) => {
    if (moveOpenTasksTo) {
      const [target] = await transaction
        .select({ id: areas.id })
        .from(areas)
        .where(
          and(
            eq(areas.id, moveOpenTasksTo),
            eq(areas.userId, userId),
            isNull(areas.archivedAt),
            ne(areas.id, areaId),
          ),
        )
        .limit(1);
      if (!target) throw new Error('Choose an active focus area.');
    }
    await transaction
      .update(tasks)
      .set({ areaId: moveOpenTasksTo, updatedAt: new Date() })
      .where(and(eq(tasks.userId, userId), eq(tasks.areaId, areaId), eq(tasks.status, 'open')));
    await transaction.delete(tasks).where(and(eq(tasks.userId, userId), eq(tasks.areaId, areaId)));

    await transaction.delete(areas).where(and(eq(areas.id, areaId), eq(areas.userId, userId)));
  });
}
