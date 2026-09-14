import { redirect } from 'next/navigation';
import { Dock } from '@/components/shell';
import { currentUser, currentUserId, hasPassphrase, preferredLoginOf } from '@/lib/session';
import { isAdminEmail } from '@/lib/admin-emails';
import { LoginMethodPicker } from './picker';
import { signOut } from './actions';
import { PassphrasePanel } from './passphrase-panel';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const userId = await currentUserId();
  if (!userId) redirect('/login');

  const user = await currentUser();
  const preferred = await preferredLoginOf(userId);
  const hasOne = await hasPassphrase(userId);
  const admin = user ? isAdminEmail(user.email) : false;
  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Security</h1>
            <span className="subtitle">
              {user?.email}
              {admin ? ' · admin' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="screen">
        <section className="src__section">
          <span className="eyebrow">Passphrase</span>
          <PassphrasePanel hasOne={hasOne} />
        </section>

        <section className="src__section">
          <span className="eyebrow">Default sign-in</span>
          <p className="src__controlNote">
            Which method the sign-in screen opens on. Both always work, this only picks the default.
          </p>
          <LoginMethodPicker current={preferred} />
        </section>

        <section className="src__section">
          <span className="eyebrow">Why they differ</span>
          <ul className="ob__list ob__list--muted">
            <li>
              <strong>Passphrase</strong> proves you know the secret and is the recovery path for
              encrypted streams once stream-key handoff is enabled.
            </li>
            <li>
              <strong>Email code</strong> proves you control the inbox. Faster, nothing to remember,
              and every chart, task and total works normally.
            </li>
          </ul>
          <p className="src__controlNote">
            Android bank-message bodies currently use a device-held key and are not readable on the
            web. Their derived transactions and totals remain available after either sign-in.
          </p>
        </section>

        <section className="src__section">
          <span className="eyebrow">Session</span>
          <p className="src__controlNote">
            Signs out this browser only. Your phone and extension keep collecting, and keep syncing.
          </p>
          <form action={signOut}>
            <button type="submit" className="btn">
              Sign out
            </button>
          </form>
        </section>
      </div>

      <Dock />
    </>
  );
}
