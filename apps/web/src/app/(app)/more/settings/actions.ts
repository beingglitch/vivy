'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  endSession,
  requireUserId,
  setPassphrase,
  setPreferredLogin,
  type LoginMethod,
} from '@/lib/session';

/**
 * Preference changes.
 *
 * Re-reads the session itself rather than accepting a user id from the client. A
 * server action is a public endpoint, so an id in its arguments would be a
 * request to edit *somebody's* settings, not necessarily your own.
 */
export async function chooseLoginMethod(method: LoginMethod): Promise<void> {
  if (method !== 'passphrase' && method !== 'email') return;
  await setPreferredLogin(await requireUserId(), method);
  revalidatePath('/more/settings');
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Set or replace this account's passphrase.
 *
 * An account provisioned from the admin allowlist has none, so this is how it
 * gains one. Sessions are deliberately *not* cleared: unlike a forgotten-
 * passphrase reset, the person doing this is already signed in and proving it,
 * so signing them out of their other devices would be punishment for a routine
 * change.
 */
export async function savePassphrase(passphrase: string, confirm: string): Promise<SaveResult> {
  if (passphrase.length < 12) {
    return { ok: false, error: 'Use at least 12 characters.' };
  }
  if (passphrase !== confirm) {
    return { ok: false, error: 'The two entries do not match.' };
  }

  await setPassphrase(await requireUserId(), passphrase);
  revalidatePath('/more/settings');
  return { ok: true };
}

/**
 * End this browser's session.
 *
 * Only this one: device tokens are untouched, so collectors keep syncing after
 * you sign out of the app. Revoking a device is a separate, deliberate act.
 */
export async function signOut(): Promise<void> {
  await endSession();
  redirect('/login');
}
