import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ReminderBanner } from '@/components/reminder-banner';
import { dueReminders } from '@/lib/onboarding';
import { currentUserId, hasPassphrase } from '@/lib/session';
import { currentAdmin } from '@/lib/admin';
import { accessFor } from '@/lib/access';

/**
 * Every designed screen shares this frame.
 *
 * This is where authentication is actually enforced, middleware only checks
 * that a cookie exists, which is a routing convenience, not a security boundary.
 *
 * On a phone `.phone` fills the viewport and the border disappears; from tablet
 * up it becomes a 390x844 device preview on the board colour, which is how the
 * canvas draws it. Same markup either way, only the media query differs.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const userId = await currentUserId();
  if (!userId) redirect('/login');

  // An allowlisted account is provisioned at first sign-in without one. It
  // cannot open sealed data until this is set, so it is collected before the app
  // rather than offered as an optional setting later.
  if (!(await hasPassphrase(userId))) redirect('/set-passphrase');

  // An admin account only mints invites. It has no streams, tasks or money, so
  // the tracker would be five permanently empty screens.
  if (await currentAdmin()) redirect('/admin');

  // Checked last: an admin has no access period, and someone without a
  // passphrase has not finished setting up, so neither should see this screen.
  if (!(await accessFor(userId)).allowed) redirect('/access-ended');

  const due = await dueReminders(userId);

  return (
    <div className="board">
      <div className="phone">
        {due.length > 0 ? (
          <ReminderBanner name={due[0]!.source.name} sourceId={due[0]!.source.id} />
        ) : null}
        {children}
      </div>
    </div>
  );
}
