import 'server-only';
import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { accessGrants, db, users } from '@vivy/db';
import { addPeriod, type PeriodUnit } from './period';

/**
 * Access periods.
 *
 * An account's access ends on a date. Ending it never deletes anything: the row
 * and every event, transaction and rollup attached to it stay exactly where they
 * are, and only the ability to open the app stops. That is what makes
 * reactivation a single write instead of a restore.
 */

export {
  addPeriod,
  describePeriod,
  isPeriodUnit,
  PERIOD_UNITS,
  type PeriodUnit,
} from './period';

export type AccessState = 'active' | 'expired' | 'stopped' | 'never-granted';

export interface Access {
  state: AccessState;
  expiresAt: Date | null;
  allowed: boolean;
}

export async function accessFor(userId: string): Promise<Access> {
  const rows = await db()
    .select({ expiresAt: users.accessExpiresAt, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return { state: 'never-granted', expiresAt: null, allowed: false };

  // Stopped outranks expiry: an admin decision should not be undone by the
  // clock, and should not read as "just renew".
  if (row.status === 'stopped') {
    return { state: 'stopped', expiresAt: row.expiresAt, allowed: false };
  }
  if (!row.expiresAt) return { state: 'never-granted', expiresAt: null, allowed: false };
  if (row.expiresAt <= new Date()) {
    return { state: 'expired', expiresAt: row.expiresAt, allowed: false };
  }
  return { state: 'active', expiresAt: row.expiresAt, allowed: true };
}

/**
 * Grant a period of access.
 *
 * Extends from whichever is later: now, or the current expiry. Renewing early
 * should add to what is left rather than throwing the remainder away.
 */
export async function grantAccess(
  userId: string,
  amount: number,
  unit: PeriodUnit,
  source: 'invite' | 'admin',
  inviteId?: string,
): Promise<Date> {
  const current = await accessFor(userId);
  const base =
    current.expiresAt && current.expiresAt > new Date() ? current.expiresAt : new Date();
  const expiresAt = addPeriod(base, amount, unit);

  await db()
    .update(users)
    .set({ accessExpiresAt: expiresAt, status: 'active' })
    .where(eq(users.id, userId));

  // Append-only history, so "latest cycle" is a query and nothing is overwritten.
  await db()
    .insert(accessGrants)
    .values({
      id: randomUUID(),
      userId,
      expiresAt,
      source,
      inviteId: inviteId ?? null,
      amount,
      unit,
    });

  return expiresAt;
}

export async function setStatus(userId: string, status: 'active' | 'stopped'): Promise<void> {
  await db().update(users).set({ status }).where(eq(users.id, userId));
}

/** The most recent grant, for showing the current cycle in the console. */
export async function latestGrant(userId: string) {
  const rows = await db()
    .select()
    .from(accessGrants)
    .where(eq(accessGrants.userId, userId))
    .orderBy(desc(accessGrants.grantedAt))
    .limit(1);
  return rows[0] ?? null;
}
