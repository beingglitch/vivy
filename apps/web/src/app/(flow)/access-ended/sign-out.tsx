import { redirect } from 'next/navigation';
import { endSession } from '@/lib/session';

/**
 * The only control on the access-ended screen.
 *
 * A server action in a plain form, so it works with no client JavaScript: this
 * is the one screen where being stuck with no way out would be worst.
 */
export function SignOutButton() {
  async function signOut() {
    'use server';
    await endSession();
    redirect('/login');
  }

  return (
    <form action={signOut}>
      <button type="submit" className="btn btn--quiet">
        Sign out
      </button>
    </form>
  );
}
