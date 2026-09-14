'use server';

import { revalidatePath } from 'next/cache';
import { updateAccentColour } from '@/lib/profile';
import { requireUserId } from '@/lib/session';

export async function saveAccentColour(
  accentColour: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await updateAccentColour(await requireUserId(), accentColour);
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save colour.' };
  }
}
