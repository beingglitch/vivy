import 'server-only';
import { currentUser } from './session';
import { isAdminEmail } from './admin-emails';

export { adminEmails, isAdminEmail, canSignUpWithoutInvite } from './admin-emails';

/**
 * The signed-in user, if they are an admin. Null otherwise.
 *
 * Requires a real session: admin is a capability on a normal account, not a
 * separate login. The allowlist decides *which* account gets it.
 */
export async function currentAdmin(): Promise<{ id: string; email: string } | null> {
  const user = await currentUser();
  if (!user) return null;
  return isAdminEmail(user.email) ? user : null;
}
