'use server';

import { revalidatePath } from 'next/cache';
import { createTask, deleteTask, setTaskStatus } from '@/lib/tasks';
import { requireUserId } from '@/lib/session';

export type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath('/quadrant');
  revalidatePath('/today');
  revalidatePath('/more/areas');
}

export async function addTask(input: {
  title: string;
  areaId: string | null;
  importance: number;
  effortMinutes: number;
  dueAt: string | null;
}): Promise<Result> {
  try {
    await createTask(await requireUserId(), {
      title: input.title,
      areaId: input.areaId,
      importance: input.importance,
      effortMinutes: input.effortMinutes,
      // Dates cross the wire as strings; an invalid one becomes no due date
      // rather than an Invalid Date that would poison every placement.
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save.' };
  }
}

export async function completeTask(taskId: string): Promise<Result> {
  try {
    await setTaskStatus(await requireUserId(), taskId, 'done');
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not update that task.' };
  }
}

export async function reopenTask(taskId: string): Promise<Result> {
  try {
    await setTaskStatus(await requireUserId(), taskId, 'open');
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not update that task.' };
  }
}

export async function removeTask(taskId: string): Promise<Result> {
  try {
    await deleteTask(await requireUserId(), taskId);
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not delete that task.' };
  }
}
