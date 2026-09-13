import 'server-only';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq, gt, lt } from 'drizzle-orm';
import { deriveAuthHash, fromHex, generateSalt, toHex } from '@vivy/crypto';
import { db, emailVerifications, sessions, users } from '@vivy/db';
import { isAdminEmail } from './admin-emails';

/**
 * Multi-tenant auth.
 *
 * Signup is email -> one-time code -> passphrase. The passphrase is hashed with
 * Argon2id for login and, separately, derives that user's key for sealed streams
 * on their own device, which is why this is a passphrase rather than an OAuth
 * handoff. A provider token cannot decrypt anything.
 *
 * Every credential in here is stored hashed. A database dump should yield
 * nothing replayable.
 */

const COOKIE = 'vivy_session';
const SESSION_DAYS = 30;
const CODE_TTL_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function equal(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/* ----------------------------------------------------------------- signup -- */

/**
 * Issue a verification code.
 *
 * The code never travels back to the browser. Real delivery is not wired up
 * yet, so in development it is written to the server log instead, which keeps
 * the shortcut on the machine running the app rather than on the screen of
 * whoever happens to be looking at it.
 */
export type CodePurpose = 'signup' | 'reset' | 'login';
export type LoginMethod = 'passphrase' | 'email';

const PREF_COOKIE = 'vivy_login_pref';

async function issueCode(email: string, purpose: CodePurpose): Promise<void> {
  const fixed = process.env['DEV_OTP_CODE'];
  const code = fixed ?? String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  await db()
    .insert(emailVerifications)
    .values({ email, purpose, codeHash: sha(code), expiresAt, attempts: 0 })
    .onConflictDoUpdate({
      target: emailVerifications.email,
      set: { purpose, codeHash: sha(code), expiresAt, attempts: 0 },
    });

  // Stand-in for sending the email. Guarded on the dev variable, so a
  // production deploy without it never prints a live code.
  if (fixed) console.log(`[vivy] ${purpose} code for ${email}: ${code}`);
}

export async function requestCode(email: string): Promise<void> {
  const normalised = normaliseEmail(email);

  const existing = await db().select().from(users).where(eq(users.email, normalised)).limit(1);
  if (existing.length > 0) throw new Error('That email already has an account. Sign in instead.');

  await issueCode(normalised, 'signup');
}

/**
 * Start a passphrase reset.
 *
 * Deliberately succeeds whether or not the account exists. Telling a stranger
 * "no account with that email" turns this form into a free tool for discovering
 * who has signed up, the classic user-enumeration leak. A code is only actually
 * issued when there is somebody to issue it to.
 */
export async function requestReset(email: string): Promise<void> {
  const normalised = normaliseEmail(email);

  const existing = await db().select().from(users).where(eq(users.email, normalised)).limit(1);
  if (existing.length === 0) {
    // No row written, and the caller is told nothing different.
    console.log(`[vivy] reset requested for ${normalised}, no such account`);
    return;
  }

  await issueCode(normalised, 'reset');
}

/**
 * Start an email sign-in.
 *
 * Same no-enumeration rule as reset: the response is identical whether or not
 * the account exists, and a code is only written when there is someone to sign
 * in.
 */
export async function requestLoginCode(email: string): Promise<void> {
  const normalised = normaliseEmail(email);

  const existing = await db().select().from(users).where(eq(users.email, normalised)).limit(1);

  // An allowlisted email is pre-authorised: it does not sign up, it is
  // provisioned the first time it signs in. Putting the address in the
  // environment is the authorisation, so asking it to complete a signup form as
  // well would be ceremony with nothing behind it.
  if (existing.length === 0 && !isAdminEmail(normalised)) {
    console.log(`[vivy] login code requested for ${normalised}, no such account`);
    return;
  }

  await issueCode(normalised, 'login');
}

/**
 * Create the row for an allowlisted email that has never signed in.
 *
 * Created without a passphrase, because there is nobody to ask at this point.
 * The app redirects to /set-passphrase until one exists, so this state lasts
 * exactly one screen.
 */
async function provisionAdmin(email: string): Promise<string> {
  const id = randomUUID();
  await db()
    .insert(users)
    .values({ id, email, passphraseHash: null, authSalt: null, emailVerifiedAt: new Date() })
    .onConflictDoNothing({ target: users.email });

  const rows = await db().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return rows[0]?.id ?? id;
}

/**
 * Finish an email sign-in.
 *
 * Worth being clear about the trade: this signs you in without the passphrase,
 * so it cannot derive the key for sealed streams. Plaintext data, tasks, money
 * aggregates, rollups, every chart, is all there. Sealed raw stays locked until
 * the passphrase is entered. See ADR 0004.
 */
export async function loginWithCode(email: string, code: string): Promise<string | null> {
  if (!(await checkCode(email, code, 'login'))) return null;

  const normalised = normaliseEmail(email);
  const rows = await db().select().from(users).where(eq(users.email, normalised)).limit(1);

  // First sign-in for an allowlisted email creates the account here.
  const userId = rows[0]?.id ?? (isAdminEmail(normalised) ? await provisionAdmin(normalised) : null);
  if (!userId) return null;

  await db().delete(emailVerifications).where(eq(emailVerifications.email, normalised));
  return userId;
}

/* ------------------------------------------------------- login preference -- */

export async function preferredLoginOf(userId: string): Promise<LoginMethod> {
  const rows = await db()
    .select({ preferredLogin: users.preferredLogin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return (rows[0]?.preferredLogin as LoginMethod) ?? 'passphrase';
}

export async function setPreferredLogin(userId: string, method: LoginMethod): Promise<void> {
  await db().update(users).set({ preferredLogin: method }).where(eq(users.id, userId));
  await rememberLoginMethod(method);
}

/**
 * Remember the method in a cookie.
 *
 * The login screen has to choose a default tab before it knows who is signing
 * in, so the database preference is unreachable at that moment. This cookie is
 * only a UI hint, it carries no identity and grants nothing, which is why it is
 * readable by the page rather than httpOnly.
 */
export async function rememberLoginMethod(method: LoginMethod): Promise<void> {
  const jar = await cookies();
  jar.set(PREF_COOKIE, method, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function lastLoginMethod(): Promise<LoginMethod> {
  const jar = await cookies();
  return jar.get(PREF_COOKIE)?.value === 'email' ? 'email' : 'passphrase';
}

export async function checkCode(
  email: string,
  code: string,
  purpose: CodePurpose = 'signup'): Promise<boolean> {
  const normalised = normaliseEmail(email);
  const rows = await db()
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.email, normalised))
    .limit(1);

  const row = rows[0];
  if (!row) return false;
  // A signup code must not be usable to reset an existing account.
  if (row.purpose !== purpose) return false;
  if (row.expiresAt < new Date()) return false;
  // Without this, six digits fall to a script in seconds.
  if (row.attempts >= MAX_CODE_ATTEMPTS) return false;

  await db()
    .update(emailVerifications)
    .set({ attempts: row.attempts + 1 })
    .where(eq(emailVerifications.email, normalised));

  return equal(sha(code.trim()), row.codeHash);
}

/** Create the account. Assumes the code was already checked in this request. */
export async function createUser(email: string, passphrase: string): Promise<string> {
  const normalised = normaliseEmail(email);
  const salt = generateSalt();
  const id = randomUUID();

  await db()
    .insert(users)
    .values({
      id,
      email: normalised,
      authSalt: toHex(salt),
      passphraseHash: toHex(deriveAuthHash(passphrase, salt)),
      emailVerifiedAt: new Date(),
    });

  await db().delete(emailVerifications).where(eq(emailVerifications.email, normalised));
  return id;
}

/* ------------------------------------------------------------------ login -- */

/** Returns the user id on success, null otherwise. Never says which half failed. */
export async function verifyLogin(email: string, passphrase: string): Promise<string | null> {
  const rows = await db()
    .select()
    .from(users)
    .where(eq(users.email, normaliseEmail(email)))
    .limit(1);

  const user = rows[0];
  // No passphrase set yet: this account signs in by email code only. Reported
  // as a plain failure, because saying so would reveal that the account exists.
  if (!user || !user.passphraseHash || !user.authSalt) return null;

  const candidate = Buffer.from(deriveAuthHash(passphrase, fromHex(user.authSalt)));
  const stored = Buffer.from(fromHex(user.passphraseHash));
  if (candidate.length !== stored.length) return null;
  return timingSafeEqual(candidate, stored) ? user.id : null;
}

/**
 * Set a new passphrase after a verified reset code.
 *
 * Three things happen together, and all three matter:
 *
 * 1. A **new salt** is generated. Reusing the old one would leave the new hash
 *    derivable from any precomputation done against the old.
 * 2. **Every existing session is destroyed.** Someone resetting because they
 *    think they were compromised expects other devices to be signed out; leaving
 *    them live would make the reset cosmetic.
 * 3. The code is **consumed**, so it cannot be replayed.
 *
 * Device tokens are deliberately left alone, collectors keep syncing, and
 * revoking a phone is a separate, explicit action.
 *
 * What this cannot do is recover sealed data. The old passphrase derived that
 * key, and it is gone. See ADR 0004: the recovery code is the path for that, and
 * it is not yet wired up.
 */
export async function resetPassphrase(email: string, passphrase: string): Promise<string | null> {
  const normalised = normaliseEmail(email);
  const rows = await db().select().from(users).where(eq(users.email, normalised)).limit(1);
  const user = rows[0];
  if (!user) return null;

  const salt = generateSalt();
  await db()
    .update(users)
    .set({
      authSalt: toHex(salt),
      passphraseHash: toHex(deriveAuthHash(passphrase, salt)),
    })
    .where(eq(users.id, user.id));

  await db().delete(sessions).where(eq(sessions.userId, user.id));
  await db().delete(emailVerifications).where(eq(emailVerifications.email, normalised));

  return user.id;
}

/* --------------------------------------------------------------- sessions -- */

export async function startSession(userId: string, userAgent?: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await db()
    .insert(sessions)
    .values({ tokenHash: sha(token), userId, expiresAt, userAgent: userAgent ?? null });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    expires: expiresAt,
  });

  void db()
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .catch(() => undefined);
}

/**
 * The current user id, or null.
 *
 * Everything user-scoped calls this rather than trusting middleware, which only
 * checks that a cookie exists. This is the real boundary.
 */
export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const rows = await db()
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(and(eq(sessions.tokenHash, sha(token)), gt(sessions.expiresAt, new Date())))
      .limit(1);
    return rows[0]?.userId ?? null;
  } catch {
    return null;
  }
}

/** Throwing variant, for pages and actions that cannot proceed without a user. */
export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new Error('Not signed in');
  return id;
}

export async function currentUser(): Promise<{ id: string; email: string } | null> {
  const id = await currentUserId();
  if (!id) return null;
  const rows = await db()
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Whether this account has a passphrase at all. Drives the Settings copy. */
export async function hasPassphrase(userId: string): Promise<boolean> {
  const rows = await db()
    .select({ hash: users.passphraseHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(rows[0]?.hash);
}

/** Set or replace a passphrase for a signed-in account. */
export async function setPassphrase(userId: string, passphrase: string): Promise<void> {
  const salt = generateSalt();
  await db()
    .update(users)
    .set({ authSalt: toHex(salt), passphraseHash: toHex(deriveAuthHash(passphrase, salt)) })
    .where(eq(users.id, userId));
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db()
      .delete(sessions)
      .where(eq(sessions.tokenHash, sha(token)))
      .catch(() => undefined);
  }
  jar.delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;
