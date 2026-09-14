'use server';

import { revalidatePath } from 'next/cache';
import { updateDisplayName } from '@/lib/profile';
import { requireUserId } from '@/lib/session';

export async function saveDisplayName(
  displayName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await updateDisplayName(await requireUserId(), displayName);
    revalidatePath('/more/user');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save name.' };
  }
}
