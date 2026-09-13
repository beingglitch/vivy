'use server';

import { headers } from 'next/headers';
import {
  loginWithCode,
  normaliseEmail,
  preferredLoginOf,
  rememberLoginMethod,
  requestLoginCode,
  startSession,
  verifyLogin,
} from '@/lib/session';
import { assertNotThrottled, clearFailures, recordFailure, ThrottledError } from '@/lib/throttle';
import type { Result } from './actions';

/**
 * Two ways in.
 *
 * **Passphrase** proves you know the secret that also derives your sealing key.
 * **Email code** proves you control the inbox, and nothing more.
 *
 * They are not equivalent, and the interface says so: an email sign-in leaves
 * sealed streams locked, because there is no passphrase to derive the key from.
 * Everything in plaintext, every chart, task and total, works either way.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function passphraseLoginAction(email: string, passphrase: string): Promise<Result> {
  const normalised = normaliseEmail(email);

  try {
    // Before verifying, so a locked account does not even pay for the hash.
    await assertNotThrottled(normalised);
  } catch (error) {
    if (error instanceof ThrottledError) {
      const minutes = Math.ceil(error.retryAfterSeconds / 60);
      return { ok: false, error: `Too many attempts. Try again in ${minutes} minutes.` };
    }
    throw error;
  }

  const userId = await verifyLogin(normalised, passphrase);
  if (!userId) {
    await recordFailure(normalised);
    // Uniform failure: saying which half was wrong tells an attacker which to
    // keep guessing.
    return {
      ok: false,
      error: 'Email or passphrase is wrong. If you have not created an account yet, sign up first.',
    };
  }

  await clearFailures(normalised);
  await startSession(userId, (await headers()).get('user-agent') ?? undefined);
  // Park the account's stored preference where the login screen can read it
  // next time, since it cannot query the database before knowing the user.
  await rememberLoginMethod(await preferredLoginOf(userId));
  return { ok: true };
}

export async function sendLoginCodeAction(email: string): Promise<Result> {
  const normalised = normaliseEmail(email);
  if (!EMAIL.test(normalised)) return { ok: false, error: 'That does not look like an email.' };

  try {
    await requestLoginCode(normalised);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not send a code. Try again.' };
  }
}

export async function emailLoginAction(email: string, code: string): Promise<Result> {
  if (!/^\d{6}$/.test(code.trim())) {
    return { ok: false, error: 'Enter the six digits from the email.' };
  }

  const userId = await loginWithCode(email, code);
  if (!userId) {
    // Shown on every failure, whatever the cause, so it still says nothing about
    // whether the account exists. It just stops "no account yet" from looking
    // identical to "wrong code" with no way to tell them apart.
    return {
      ok: false,
      error: 'That code is wrong or has expired. If you have not created an account yet, sign up first.',
    };
  }

  await startSession(userId, (await headers()).get('user-agent') ?? undefined);
  await rememberLoginMethod(await preferredLoginOf(userId));
  return { ok: true };
}
