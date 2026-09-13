'use server';

import { revalidatePath } from 'next/cache';
import { createTask, deleteTask, setTaskStatus, updateTask } from '@/lib/tasks';
import { requireUserId } from '@/lib/session';

export type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath('/quadrant');
  revalidatePath('/today');
  revalidatePath('/more/areas');
}

export interface TaskInput {
  title: string;
  areaId: string | null;
  importance: number;
  effortMinutes: number;
  deadlineKind: string;
  /** ISO date. Dates cross the wire as strings, never as Date objects. */
  dueAt: string | null;
  dueAmount: number | null;
  dueUnit: string | null;
  placeLabel: string | null;
  lat: number | null;
  lng: number | null;
  radiusM: number | null;
}

export async function addTask(input: TaskInput): Promise<Result> {
  try {
    const due = input.dueAt ? new Date(input.dueAt) : null;
    // An unparseable date becomes no date rather than an Invalid Date, which
    // would poison every placement that touches it.
    const dueAt = due && !Number.isNaN(due.getTime()) ? due : null;

    await createTask(await requireUserId(), {
      title: input.title,
      areaId: input.areaId,
      importance: input.importance,
      effortMinutes: input.effortMinutes,
      dueAt,
      deadlineKind: input.deadlineKind,
      dueAmount: input.dueAmount,
      dueUnit: input.dueUnit,
      placeLabel: input.placeLabel,
      lat: input.lat,
      lng: input.lng,
      radiusM: input.radiusM,
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

export async function archiveTask(taskId: string): Promise<Result> {
  try {
    await setTaskStatus(await requireUserId(), taskId, 'dropped');
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not archive that task.' };
  }
}

export async function editTask(taskId: string, input: TaskInput): Promise<Result> {
  try {
    const due = input.dueAt ? new Date(input.dueAt) : null;
    const dueAt = due && !Number.isNaN(due.getTime()) ? due : null;
    await updateTask(await requireUserId(), taskId, { ...input, dueAt });
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save.' };
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
