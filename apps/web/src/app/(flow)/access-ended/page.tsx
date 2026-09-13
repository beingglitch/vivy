import { redirect } from 'next/navigation';
import { accessFor } from '@/lib/access';
import { currentUser, currentUserId } from '@/lib/session';
import { SignOutButton } from './sign-out';

export const dynamic = 'force-dynamic';

/**
 * Shown when access has lapsed or been stopped.
 *
 * Deliberately reassuring about data, because the fear this screen creates is
 * "have I lost everything", and the answer is no. Expiry stops access and
 * touches nothing else, so reactivation is instant.
 *
 * `stopped` and `expired` are worded differently on purpose: one is a decision
 * someone made, the other is a clock running out. Telling a stopped account to
 * "renew" would be misleading.
 */
export default async function AccessEndedPage() {
  const userId = await currentUserId();
  if (!userId) redirect('/login');

  const access = await accessFor(userId);
  if (access.allowed) redirect('/');

  const user = await currentUser();
  const ended = access.expiresAt?.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flow__body">
      <div className="auth">
        <header className="auth__head">
          <span className="auth__mark" aria-hidden>
            V
          </span>
          <h1 className="auth__title">
            {access.state === 'stopped' ? 'Access paused' : 'Your access has ended'}
          </h1>
          <p className="auth__sub">
            {access.state === 'stopped'
              ? 'An administrator paused this account.'
              : access.state === 'never-granted'
                ? 'This account has no access period yet.'
                : `It ran out on ${ended}.`}
          </p>
        </header>

        <p className="ob__note">
          <strong>Nothing has been deleted.</strong> Every chart, task and transaction is exactly
          where you left it. Access can be restored in one step, and everything comes back as it
          was.
        </p>

        <p className="auth__sub">
          Ask whoever invited you to reactivate {user?.email}, or to send a new invite code.
        </p>

        <SignOutButton />
      </div>
    </div>
  );
}
