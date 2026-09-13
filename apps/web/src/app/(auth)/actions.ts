'use server';

import { headers } from 'next/headers';
import { canSignUpWithoutInvite } from '@/lib/admin';
import { checkInvite, consumeInvite } from '@/lib/invites';
import { grantAccess, type PeriodUnit } from '@/lib/access';
import {
  checkCode,
  createUser,
  normaliseEmail,
  requestCode,
  startSession,
} from '@/lib/session';

/**
 * Auth actions.
 *
 * These return results rather than redirecting, so the multi-step signup can
 * advance in place without the email, the code, or the invite ever appearing in
 * a URL. Personal data does not belong in a query string, and a credential in
 * browser history outlives its window.
 */

export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Step one: prove you were invited, then send a code.
 *
 * The invite is checked here but *not* spent, otherwise abandoning signup at
 * the code screen would burn a single-use code for nothing.
 */
export async function sendCodeAction(email: string, invite: string): Promise<Result> {
  const normalised = normaliseEmail(email);
  if (!EMAIL.test(normalised)) return { ok: false, error: 'That does not look like an email.' };

  // Admins bootstrap the system: without this nobody could create the first
  // account, because invites require a signed-in admin to mint them.
  if (!canSignUpWithoutInvite(normalised)) {
    if (!invite.trim()) return { ok: false, error: 'Vivy is invite-only. Enter your code.' };
    if (!(await checkInvite(invite))) {
      return { ok: false, error: 'That invite code is not valid, or has been used up.' };
    }
  }

  try {
    await requestCode(normalised);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not send a code.' };
  }
}

export async function verifyCodeAction(email: string, code: string): Promise<Result> {
  if (!/^\d{6}$/.test(code.trim())) {
    return { ok: false, error: 'Enter the six digits from the email.' };
  }
  const valid = await checkCode(email, code);
  return valid
    ? { ok: true }
    : { ok: false, error: 'That code is wrong or has expired. Request a new one.' };
}

export async function completeSignupAction(
  email: string,
  code: string,
  invite: string,
  passphrase: string,
  confirm: string): Promise<Result> {
  if (passphrase.length < 12) {
    return { ok: false, error: 'Use at least 12 characters, this also unlocks your data.' };
  }
  if (passphrase !== confirm) return { ok: false, error: 'The two entries do not match.' };

  const normalised = normaliseEmail(email);

  // Both credentials are re-checked here, not trusted from earlier steps: a
  // client can call this action directly without ever having passed them.
  if (!(await checkCode(normalised, code))) {
    return { ok: false, error: 'Your code expired. Start again.' };
  }

  const needsInvite = !canSignUpWithoutInvite(normalised);
  let consumed = null;
  if (needsInvite) {
    // Spent atomically, so two people racing the last use of one code cannot
    // both get through.
    consumed = await consumeInvite(invite);
    if (!consumed) return { ok: false, error: 'That invite code is no longer valid.' };
  }

  try {
    const userId = await createUser(normalised, passphrase);
    if (consumed) {
      await grantAccess(
        userId,
        consumed.amount,
        consumed.unit as PeriodUnit,
        'invite',
        consumed.inviteId,
      );
    }
    await startSession(userId, (await headers()).get('user-agent') ?? undefined);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not create the account. That email may already be taken.' };
  }
}
