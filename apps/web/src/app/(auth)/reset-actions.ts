'use server';

import { headers } from 'next/headers';
import { checkCode, normaliseEmail, requestReset, resetPassphrase, startSession } from '@/lib/session';
import type { Result } from './actions';

/**
 * Passphrase reset.
 *
 * Mirrors signup deliberately, email, code, new passphrase, because the two
 * flows should feel identical. The differences are all defensive: codes are
 * scoped to `'reset'` so a signup code cannot be replayed here, and the first
 * step reports success whether or not the account exists.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendResetCodeAction(email: string): Promise<Result> {
  const normalised = normaliseEmail(email);
  if (!EMAIL.test(normalised)) return { ok: false, error: 'That does not look like an email.' };

  try {
    // Succeeds either way: a different answer for "no such account" would turn
    // this form into a way to discover who has signed up.
    await requestReset(normalised);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not start a reset. Try again.' };
  }
}

export async function verifyResetCodeAction(email: string, code: string): Promise<Result> {
  if (!/^\d{6}$/.test(code.trim())) {
    return { ok: false, error: 'Enter the six digits from the email.' };
  }
  const valid = await checkCode(email, code, 'reset');
  return valid
    ? { ok: true }
    : { ok: false, error: 'That code is wrong or has expired. Request a new one.' };
}

export async function completeResetAction(
  email: string,
  code: string,
  passphrase: string,
  confirm: string): Promise<Result> {
  if (passphrase.length < 12) {
    return { ok: false, error: 'Use at least 12 characters, this also unlocks your data.' };
  }
  if (passphrase !== confirm) return { ok: false, error: 'The two entries do not match.' };

  // Re-checked here, not trusted from the previous step: this action is a public
  // endpoint and can be called directly.
  if (!(await checkCode(email, code, 'reset'))) {
    return { ok: false, error: 'Your code expired. Start again.' };
  }

  const userId = await resetPassphrase(email, passphrase);
  if (!userId) return { ok: false, error: 'Could not reset that account.' };

  await startSession(userId, (await headers()).get('user-agent') ?? undefined);
  return { ok: true };
}
