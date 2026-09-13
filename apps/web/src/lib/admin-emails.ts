import 'server-only';

/**
 * The admin allowlist, read straight from the environment.
 *
 * Deliberately free of imports. `session.ts` needs it to decide whether an
 * unknown email is pre-authorised, and `admin.ts` needs `session.ts` to resolve
 * the current user; putting the list in either one would make them import each
 * other in a cycle.
 *
 * Admin is an environment variable rather than a database column on purpose. A
 * flag in the database can be granted by anything that can write to the
 * database: a SQL injection, a leaked connection string, a careless migration.
 * Changing this requires access to the deployment, which is a different
 * credential, so a full database compromise still cannot promote anyone.
 */
export function adminEmails(): string[] {
  return (process.env['VIVY_ADMIN_EMAILS'] ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  const list = adminEmails();
  // An empty list means no admins, never everyone. A misconfigured deploy
  // should lock the door, not remove it.
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}

/**
 * Allowlisted emails skip signup entirely.
 *
 * Being named in the environment *is* the authorisation. Asking such an address
 * to also complete an invite-gated signup form would be ceremony with nothing
 * behind it, so the account is provisioned on first sign-in instead.
 */
export function canSignUpWithoutInvite(email: string): boolean {
  return isAdminEmail(email);
}
