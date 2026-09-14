'use server';

import { revalidatePath } from 'next/cache';
import {
  archiveArea,
  createArea,
  deleteAreaPermanently,
  reorderAreas,
  restoreArea,
  updateArea,
} from '@/lib/areas';
import { requireUserId } from '@/lib/session';

/**
 * Every action re-checks the session itself. A server action is a public
 * endpoint wearing a function's clothes, so it cannot inherit the page's
 * authorisation.
 */

export type Result = { ok: true; areaId?: string } | { ok: false; error: string };

function refresh() {
  revalidatePath('/');
  revalidatePath('/more/areas');
  revalidatePath('/quadrant');
  revalidatePath('/today');
}

export async function addArea(
  name: string,
  colour: string,
  cadenceDays: number,
  showOnHome: boolean,
): Promise<Result> {
  try {
    const areaId = await createArea(await requireUserId(), name, colour, cadenceDays, showOnHome);
    refresh();
    return { ok: true, areaId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save.' };
  }
}

export async function editArea(
  areaId: string,
  patch: { name?: string; colour?: string; cadenceDays?: number; showOnHome?: boolean },
): Promise<Result> {
  try {
    await updateArea(await requireUserId(), areaId, patch);
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save.' };
  }
}

export async function removeArea(areaId: string, moveOpenTasksTo?: string | null): Promise<Result> {
  try {
    await archiveArea(await requireUserId(), areaId, moveOpenTasksTo);
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not archive that area.' };
  }
}

export async function resumeArea(areaId: string): Promise<Result> {
  try {
    await restoreArea(await requireUserId(), areaId);
    refresh();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not resume that area.',
    };
  }
}

export async function reorderAreaList(areaIds: string[]): Promise<Result> {
  try {
    await reorderAreas(await requireUserId(), areaIds);
    refresh();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not reorder focus areas.',
    };
  }
}

export async function deleteArea(areaId: string, moveOpenTasksTo: string | null): Promise<Result> {
  try {
    await deleteAreaPermanently(await requireUserId(), areaId, moveOpenTasksTo);
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not delete that area.' };
  }
}
