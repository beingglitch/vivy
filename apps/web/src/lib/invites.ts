import 'server-only';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  INVITE_CODE_MIN_LENGTH,
  canonicalInviteCode,
  encodeBase32,
  formatInviteCode,
} from '@vivy/core';
import { db, invites } from '@vivy/db';

/**
 * Invite codes.
 *
 * Signup is closed: an account can only be created with a valid, unspent code,
 * or by an email on the admin allowlist. That turns "anyone on the internet can
 * register" into "anyone I handed a code to".
 *
 * Codes are 128 bits. That matters for what this file does *not* need: the OTP
 * has an attempt counter because six digits fall to a script in minutes, but
 * guessing a 128-bit code is not a thing that happens, so there is no lockout to
 * implement and no failed-attempt state to keep.
 */

/** Re-exported so callers do not need to reach into @vivy/core for it. */
export const canonical = canonicalInviteCode;

function hash(code: string): string {
  return createHash('sha256').update(canonicalInviteCode(code)).digest('hex');
}

export interface NewInvite {
  code: string;
  expiresAt: Date;
}

/**
 * Mint a code. The plaintext is returned once and never stored.
 *
 * Same rule as device tokens and sessions: the database holds a one-way hash, so
 * a dump yields nothing anyone can redeem.
 */
export async function createInvite(
  createdBy: string,
  options: {
    label?: string | undefined;
    recipientEmail?: string | undefined;
    maxUses?: number;
    days?: number;
    accessAmount?: number;
    accessUnit?: string;
  } = {},
): Promise<NewInvite> {
  const code = formatInviteCode(encodeBase32(randomBytes(16)));
  const expiresAt = new Date(Date.now() + (options.days ?? 14) * 86_400_000);

  await db()
    .insert(invites)
    .values({
      id: randomUUID(),
      codeHash: hash(code),
      createdBy,
      recipientEmail: options.recipientEmail ?? null,
      label: options.label ?? null,
      maxUses: options.maxUses ?? 1,
      usedCount: 0,
      accessAmount: options.accessAmount ?? 3,
      accessUnit: options.accessUnit ?? 'month',
      expiresAt,
    });

  return { code, expiresAt };
}

/** Check a code without spending it. Used before an OTP is sent. */
export async function checkInvite(code: string): Promise<boolean> {
  if (canonical(code).length < INVITE_CODE_MIN_LENGTH) return false;

  const rows = await db().select().from(invites).where(eq(invites.codeHash, hash(code))).limit(1);
  const invite = rows[0];
  if (!invite) return false;
  if (invite.revokedAt) return false;
  if (invite.expiresAt < new Date()) return false;
  return invite.usedCount < invite.maxUses;
}

/**
 * Spend a use, atomically.
 *
 * The conditional UPDATE is the whole point. Reading the row, checking
 * `usedCount < maxUses`, then writing back would let two signups submitting the
 * same single-use code at the same moment both pass the check and both succeed.
 * Letting Postgres do the comparison inside the write makes that impossible.
 */
export interface ConsumedInvite {
  inviteId: string;
  amount: number;
  unit: string;
}

export async function consumeInvite(code: string): Promise<ConsumedInvite | null> {
  const result = await db()
    .update(invites)
    .set({ usedCount: sql`${invites.usedCount} + 1` })
    .where(
      and(
        eq(invites.codeHash, hash(code)),
        isNull(invites.revokedAt),
        sql`${invites.expiresAt} > now()`,
        sql`${invites.usedCount} < ${invites.maxUses}`,
      ),
    )
    // Returned from the same statement that spends the use, so the period
    // granted is always the one on the row that was actually consumed.
    .returning({
      id: invites.id,
      amount: invites.accessAmount,
      unit: invites.accessUnit,
    });

  const row = result[0];
  return row ? { inviteId: row.id, amount: row.amount, unit: row.unit } : null;
}

export async function listInvites(createdBy: string) {
  return db()
    .select()
    .from(invites)
    .where(eq(invites.createdBy, createdBy))
    .orderBy(desc(invites.createdAt))
    .limit(50);
}

export async function revokeInvite(id: string, createdBy: string): Promise<void> {
  await db()
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.id, id), eq(invites.createdBy, createdBy)));
}

/** Constant-time compare, exported for tests and any future direct use. */
export function codesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(hash(a), 'hex');
  const bufB = Buffer.from(hash(b), 'hex');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
