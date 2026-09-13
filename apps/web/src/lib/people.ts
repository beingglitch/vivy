import 'server-only';
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { accessGrants, db, invites, users } from '@vivy/db';
import { adminEmails } from './admin-emails';

/**
 * Reading the world for the admin console.
 *
 * Admin accounts are filtered out of the people list: they have no access period
 * and nothing to renew, so showing them would put rows in the table that none of
 * its controls apply to.
 */

export interface Person {
  id: string;
  email: string;
  status: string;
  accessExpiresAt: Date | null;
  createdAt: Date;
  lastGrant: { amount: number; unit: string; grantedAt: Date; source: string } | null;
}

export async function listPeople(): Promise<Person[]> {
  const admins = adminEmails();

  const rows = await db()
    .select({
      id: users.id,
      email: users.email,
      status: users.status,
      accessExpiresAt: users.accessExpiresAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const people = rows.filter((r) => !admins.includes(r.email));

  // One query per person is fine at this scale and keeps the shape obvious; a
  // lateral join would be premature for a table measured in tens of rows.
  return Promise.all(
    people.map(async (person) => {
      const grants = await db()
        .select({
          amount: accessGrants.amount,
          unit: accessGrants.unit,
          grantedAt: accessGrants.grantedAt,
          source: accessGrants.source,
        })
        .from(accessGrants)
        .where(eq(accessGrants.userId, person.id))
        .orderBy(desc(accessGrants.grantedAt))
        .limit(1);

      return { ...person, lastGrant: grants[0] ?? null };
    }),
  );
}

/** Codes that could still be redeemed. What "pending" means in the console. */
export async function listPendingInvites(createdBy: string) {
  return db()
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.createdBy, createdBy),
        isNull(invites.revokedAt),
        sql`${invites.expiresAt} > now()`,
        sql`${invites.usedCount} < ${invites.maxUses}`,
      ),
    )
    .orderBy(desc(invites.createdAt))
    .limit(50);
}

/** Everything else: spent, expired or revoked. Kept for the audit trail. */
export async function listSettledInvites(createdBy: string) {
  return db()
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.createdBy, createdBy),
        sql`(${invites.revokedAt} is not null
             or ${invites.expiresAt} <= now()
             or ${invites.usedCount} >= ${invites.maxUses})`,
      ),
    )
    .orderBy(desc(invites.createdAt))
    .limit(50);
}

/**
 * Move an account to a different email address.
 *
 * This *is* the data migration. Everything a person owns is keyed on `userId`,
 * never on their email, so changing the address moves every event, transaction,
 * chart and device with it by definition. There is nothing to copy.
 *
 * The alternative, starting fresh, is simply not calling this: let them sign up
 * on the new address and leave the old account alone.
 */
export async function changeEmail(userId: string, newEmail: string): Promise<void> {
  const normalised = newEmail.trim().toLowerCase();

  const clash = await db()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, normalised), ne(users.id, userId)))
    .limit(1);
  if (clash.length > 0) throw new Error('Another account already uses that email.');

  await db().update(users).set({ email: normalised }).where(eq(users.id, userId));
}
