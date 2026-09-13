import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Dock } from '@/components/shell';
import { currentUser, currentUserId, hasPassphrase, preferredLoginOf } from '@/lib/session';
import { isAdminEmail } from '@/lib/admin-emails';
import { LoginMethodPicker } from './picker';
import { signOut } from './actions';
import { PassphrasePanel } from './passphrase-panel';
import { lookupAndroidRelease } from '@/lib/releases';
import { listDevices } from '@/lib/devices';
import { AndroidApp } from './android-app';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const userId = await currentUserId();
  if (!userId) redirect('/login');

  const user = await currentUser();
  const preferred = await preferredLoginOf(userId);
  const hasOne = await hasPassphrase(userId);
  const admin = user ? isAdminEmail(user.email) : false;
  const lookup = await lookupAndroidRelease();
  const release = lookup.ok ? lookup.release : null;
  const phones = await listDevices(userId, 'android');

  // The address the browser actually used, so the QR points somewhere reachable
  // rather than at a hardcoded guess.
  const head = await headers();
  const host = head.get('host') ?? 'localhost:3000';
  const proto = head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');

  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Settings</h1>
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
            Which method the sign-in screen opens on. Both always work, this only picks the
            default.
          </p>
          <LoginMethodPicker current={preferred} />
        </section>

        <section className="src__section">
          <span className="eyebrow">Why they differ</span>
          <ul className="ob__list ob__list--muted">
            <li>
              <strong>Passphrase</strong> proves you know the secret. It also derives the key that
              decrypts your sealed raw data, so this is the only method that unlocks everything.
            </li>
            <li>
              <strong>Email code</strong> proves you control the inbox. Faster, nothing to
              remember, and every chart, task and total works normally. Sealed raw data stays
              locked until you enter the passphrase.
            </li>
          </ul>
          <p className="src__controlNote">
            Nothing is sealed yet, so the two are equivalent today. That changes once the Android
            collector starts capturing screen text and bank messages.
          </p>
        </section>

        <AndroidApp
          release={release}
          origin={`${proto}://${host}`}
          phones={phones}
          problem={lookup.ok ? undefined : lookup.problem}
        />

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
