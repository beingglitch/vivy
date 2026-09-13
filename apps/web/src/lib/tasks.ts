import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, ne } from 'drizzle-orm';
import { areas, db, tasks } from '@vivy/db';
import { EFFORTS, IMPORTANCE } from './task-scales';

export { EFFORTS, IMPORTANCE };

/**
 * Tasks, and where they sit on the quadrant.
 *
 * The placement maths lives here rather than in the page, so the quadrant and
 * anything else that plots a task agree by construction.
 */

export interface Task {
  id: string;
  title: string;
  importance: number;
  effortMinutes: number;
  status: string;
  dueAt: Date | null;
  completedAt: Date | null;
  areaId: string | null;
  areaName: string | null;
  areaColour: string | null;
  /** Percent from the left of the grid. */
  x: number;
  /** Percent from the top. Low is more important, since the y axis points up. */
  y: number;
  /** Pixels. Bigger dot, longer job. */
  size: number;
}

/**
 * Where a task lands.
 *
 * X is effort on a log scale, because the interesting distinction is between
 * five minutes and an hour, not between three and four hours. Linear would
 * crush every quick task into the left edge, which is precisely the half you
 * want to read.
 *
 * Y is importance, lifted by how close the due date is. A normal task due today
 * should sit above a high one due next month, because that is the order you
 * would actually do them in.
 */
export function place(importance: number, effortMinutes: number, dueAt: Date | null) {
  const minutes = Math.min(Math.max(effortMinutes, 5), 240);
  const x = ((Math.log(minutes) - Math.log(5)) / (Math.log(240) - Math.log(5))) * 100;

  let weight = (importance - 1) / 3; // 0 to 1
  if (dueAt) {
    const days = (dueAt.getTime() - Date.now()) / 86_400_000;
    // Full push when overdue, fading out over a fortnight.
    const urgency = days <= 0 ? 1 : Math.max(0, 1 - days / 14);
    weight = Math.min(1, weight + urgency * 0.4);

    // Already overdue belongs in the top half whatever its importance. The
    // boost alone cannot get a low task across the midline, and a missed
    // deadline sitting in the "not important" half is the one thing this
    // screen must never say. A floor rather than a bigger boost, so it still
    // ranks below genuinely critical work.
    if (days <= 0) weight = Math.max(weight, 0.6);
  }

  return {
    // Inset so a dot at either extreme is not clipped by the grid border.
    x: 6 + x * 0.88,
    y: 6 + (1 - weight) * 88,
    size: 8 + (minutes / 240) * 16,
  };
}

export async function listTasks(userId: string, status = 'open'): Promise<Task[]> {
  const rows = await db()
    .select({
      id: tasks.id,
      title: tasks.title,
      importance: tasks.importance,
      effortMinutes: tasks.effortMinutes,
      status: tasks.status,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
      areaId: tasks.areaId,
      areaName: areas.name,
      areaColour: areas.colour,
    })
    .from(tasks)
    .leftJoin(areas, eq(tasks.areaId, areas.id))
    .where(and(eq(tasks.userId, userId), eq(tasks.status, status)))
    .orderBy(asc(tasks.createdAt));

  return rows.map((r) => ({
    ...r,
    ...place(r.importance, r.effortMinutes, r.dueAt),
  }));
}

export async function createTask(
  userId: string,
  input: {
    title: string;
    areaId?: string | null;
    importance?: number;
    effortMinutes?: number;
    dueAt?: Date | null;
  },
): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error('Give the task a title.');
  if (title.length > 200) throw new Error('That title is too long.');

  await db()
    .insert(tasks)
    .values({
      id: randomUUID(),
      userId,
      title,
      areaId: input.areaId ?? null,
      importance: clamp(input.importance ?? 2, 1, 4),
      effortMinutes: clamp(input.effortMinutes ?? 30, 5, 240),
      dueAt: input.dueAt ?? null,
    });
}

export async function setTaskStatus(
  userId: string,
  taskId: string,
  status: 'open' | 'done' | 'dropped',
): Promise<void> {
  await db()
    .update(tasks)
    .set({
      status,
      // Cleared when reopening, so an area's cadence does not keep counting a
      // completion that was undone.
      completedAt: status === 'done' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  await db().delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}

/**
 * Finished since midnight, for the Today screen.
 *
 * Scoped to today on purpose: a list of everything ever completed would grow
 * without limit and bury the part that is still open.
 */
export async function doneToday(userId: string): Promise<Task[]> {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const all = await listTasks(userId, 'done');
  return all.filter((t) => t.completedAt !== null && t.completedAt >= midnight);
}

/** How many tasks are not open, used to decide whether a screen is truly empty. */
export async function hasAnyTask(userId: string): Promise<boolean> {
  const rows = await db()
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), ne(tasks.status, 'dropped')))
    .limit(1);
  return rows.length > 0;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(Math.max(Math.round(n), lo), hi);
}
