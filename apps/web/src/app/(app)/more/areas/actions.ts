'use server';

import { revalidatePath } from 'next/cache';
import { archiveArea, createArea, deleteAreaPermanently, updateArea } from '@/lib/areas';
import { requireUserId } from '@/lib/session';

/**
 * Every action re-checks the session itself. A server action is a public
 * endpoint wearing a function's clothes, so it cannot inherit the page's
 * authorisation.
 */

export type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath('/');
  revalidatePath('/more/areas');
  revalidatePath('/quadrant');
  revalidatePath('/today');
}

export async function addArea(name: string, colour: string): Promise<Result> {
  try {
    await createArea(await requireUserId(), name, colour);
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save.' };
  }
}

export async function editArea(
  areaId: string,
  patch: { name?: string; colour?: string },
): Promise<Result> {
  try {
    await updateArea(await requireUserId(), areaId, patch);
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save.' };
  }
}

export async function removeArea(areaId: string): Promise<Result> {
  try {
    await archiveArea(await requireUserId(), areaId);
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not archive that area.' };
  }
}

export async function deleteArea(areaId: string): Promise<Result> {
  try {
    await deleteAreaPermanently(await requireUserId(), areaId);
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not delete that area.' };
  }
}
