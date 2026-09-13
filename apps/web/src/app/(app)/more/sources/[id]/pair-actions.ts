'use server';

import { revalidatePath } from 'next/cache';
import { pairDevice, revokeDevice, type Pairing } from '@/lib/devices';
import { requireUserId } from '@/lib/session';

/**
 * Every action re-checks the session itself. A server action is a public
 * endpoint wearing a function's clothes, so it cannot inherit the page's
 * authorisation.
 */

export async function pair(name: string): Promise<Pairing> {
  const userId = await requireUserId();
  const result = await pairDevice(userId, name, 'android', name.trim() || 'Android phone');
  revalidatePath('/more/sources/android');
  return result;
}

export async function revoke(deviceId: string): Promise<void> {
  const userId = await requireUserId();
  await revokeDevice(userId, deviceId);
  revalidatePath('/more/sources/android');
}
