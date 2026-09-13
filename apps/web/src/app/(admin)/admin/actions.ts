'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin';
import { createInvite, revokeInvite } from '@/lib/invites';
import { grantAccess, setStatus, type PeriodUnit } from '@/lib/access';
import { changeEmail } from '@/lib/people';
import { endSession } from '@/lib/session';

/**
 * Admin actions.
 *
 * Every one re-checks admin status itself rather than trusting that the page
 * rendered. A server action is a public HTTP endpoint: anyone can invoke it
 * directly, whether or not they can see the button that calls it.
 */

export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNITS = ['day', 'week', 'month', 'year'];

function validPeriod(amount: number, unit: string): boolean {
  return Number.isInteger(amount) && amount >= 1 && amount <= 60 && UNITS.includes(unit);
}

export interface Minted {
  code: string;
  expiresAt: string;
  recipient: string | null;
  period: string;
}

export async function mintInvite(
  recipientEmail: string,
  maxUses: number,
  days: number,
  accessAmount: number,
  accessUnit: string,
): Promise<Result<Minted>> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, error: 'Only an administrator can create invites.' };

  const recipient = recipientEmail.trim().toLowerCase();
  // Optional: a code headed for WhatsApp or SMS has no address to record.
  if (recipient && !EMAIL.test(recipient)) {
    return { ok: false, error: 'That does not look like an email.' };
  }
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 50) {
    return { ok: false, error: 'Uses must be between 1 and 50.' };
  }
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    return { ok: false, error: 'The code must expire within 1 to 90 days.' };
  }
  if (!validPeriod(accessAmount, accessUnit)) {
    return { ok: false, error: 'Choose an access period between 1 and 60 units.' };
  }

  const invite = await createInvite(admin.id, {
    recipientEmail: recipient || undefined,
    label: recipient || undefined,
    maxUses,
    days,
    accessAmount,
    accessUnit,
  });

  revalidatePath('/admin');
  return {
    ok: true,
    data: {
      code: invite.code,
      expiresAt: invite.expiresAt.toISOString(),
      recipient: recipient || null,
      period: `${accessAmount} ${accessUnit}${accessAmount === 1 ? '' : 's'}`,
    },
  };
}

export async function killInvite(id: string): Promise<void> {
  const admin = await currentAdmin();
  if (!admin) return;
  // Scoped to the caller inside the query too, so one admin cannot revoke a code
  // minted by another just by knowing its id.
  await revokeInvite(id, admin.id);
  revalidatePath('/admin');
}

/**
 * Renew someone directly, with no code.
 *
 * The point of the Users tab: an expired account is reactivated in one step,
 * because nothing was deleted when it lapsed.
 */
export async function extendPerson(
  userId: string,
  amount: number,
  unit: string,
): Promise<Result<{ expiresAt: string }>> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, error: 'Not authorised.' };
  if (!validPeriod(amount, unit)) {
    return { ok: false, error: 'Choose a period between 1 and 60 units.' };
  }

  const expiresAt = await grantAccess(userId, amount, unit as PeriodUnit, 'admin');
  revalidatePath('/admin');
  return { ok: true, data: { expiresAt: expiresAt.toISOString() } };
}

export async function setPersonStatus(userId: string, stopped: boolean): Promise<void> {
  const admin = await currentAdmin();
  if (!admin) return;
  await setStatus(userId, stopped ? 'stopped' : 'active');
  revalidatePath('/admin');
}

/**
 * Move an account to a new address.
 *
 * Everything is keyed on the user id rather than the email, so this moves every
 * event, transaction and chart with it. There is no copying step.
 */
export async function movePerson(userId: string, newEmail: string): Promise<Result> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, error: 'Not authorised.' };

  const email = newEmail.trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: 'That does not look like an email.' };

  try {
    await changeEmail(userId, email);
    revalidatePath('/admin');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not move that account.',
    };
  }
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect('/login');
}
