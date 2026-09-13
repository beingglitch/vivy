import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { authAttempts, db } from '@vivy/db';

/**
 * Bound guessing against a single account.
 *
 * Argon2id already makes one attempt expensive. This makes the *number* of
 * attempts finite, which expense alone never does.
 *
 * Deliberately keyed on email, not IP: an IP is a rented commodity, and locking
 * by IP hands anyone a way to lock a user out from their address. Locking the
 * email slows the only thing worth slowing.
 */

/** Tries before the door closes. Generous enough that a typo streak is survivable. */
const LIMIT = 8;

/** How long the door stays closed. */
const LOCKOUT_MINUTES = 15;

/** Forget a stale failure streak, so yesterday's fat fingers do not count today. */
const WINDOW_MINUTES = 60;

export class ThrottledError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many attempts. Try again later.');
    this.name = 'ThrottledError';
  }
}

/**
 * Throw if this email is locked out.
 *
 * Call before verifying anything: the point is to not do the expensive work.
 */
export async function assertNotThrottled(email: string): Promise<void> {
  const rows = await db()
    .select()
    .from(authAttempts)
    .where(eq(authAttempts.email, email))
    .limit(1);

  const row = rows[0];
  if (!row?.lockedUntil) return;

  const remaining = row.lockedUntil.getTime() - Date.now();
  if (remaining > 0) throw new ThrottledError(Math.ceil(remaining / 1000));
}

/**
 * Record a failure, locking the email once the limit is reached.
 *
 * The counter resets if the previous failure is older than the window, so a
 * slow trickle of genuine mistakes never accumulates into a lockout.
 */
export async function recordFailure(email: string): Promise<void> {
  // Every time is computed by Postgres rather than passed in from here. It
  // keeps Date objects out of the SQL template, and it means the lockout cannot
  // be shortened by a server whose clock runs fast.
  const window = sql.raw(`interval '${WINDOW_MINUTES} minutes'`);
  const lockout = sql.raw(`interval '${LOCKOUT_MINUTES} minutes'`);
  const cold = sql`${authAttempts.firstFailureAt} < now() - ${window}`;

  await db()
    .insert(authAttempts)
    .values({ email, failures: 1, lockedUntil: null })
    .onConflictDoUpdate({
      target: authAttempts.email,
      set: {
        // Restart the count if the streak has gone cold, otherwise add to it.
        failures: sql`case when ${cold} then 1 else ${authAttempts.failures} + 1 end`,
        firstFailureAt: sql`case when ${cold} then now() else ${authAttempts.firstFailureAt} end`,
        lockedUntil: sql`case when not ${cold} and ${authAttempts.failures} + 1 >= ${LIMIT}
                              then now() + ${lockout}
                              else null end`,
      },
    });
}

/** Wipe the streak. Called on every success, so a good login clears the slate. */
export async function clearFailures(email: string): Promise<void> {
  await db().delete(authAttempts).where(eq(authAttempts.email, email));
}
