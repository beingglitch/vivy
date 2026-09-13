import { headers } from 'next/headers';
import { currentAdmin } from '@/lib/admin';
import { listPendingInvites, listPeople } from '@/lib/people';
import { InviteConsole } from './console';
import { PendingInvites } from './pending';
import { People } from './people';
import { AdminTabs } from './tabs';
import { signOut } from './actions';

export const dynamic = 'force-dynamic';

/**
 * The admin console: the whole surface of an admin account.
 *
 * Mint a code, see what is outstanding, manage who has access. No tab bar to the
 * tracker, because an admin is not a Vivy user and those screens would be
 * permanently empty for it.
 */
export default async function AdminPage() {
  // Guaranteed by the layout; re-read for the id and email.
  const admin = await currentAdmin();
  const [pendingInvites, people] = admin
    ? await Promise.all([listPendingInvites(admin.id), listPeople()])
    : [[], []];

  const head = await headers();
  const host = head.get('host') ?? 'localhost:3000';
  const proto = head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const signupUrl = `${proto}://${host}/signup`;

  const active = people.filter(
    (p) => p.status !== 'stopped' && p.accessExpiresAt && p.accessExpiresAt > new Date(),
  ).length;

  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Access</h1>
            <span className="subtitle">
              {active} active · {people.length} total
            </span>
          </div>
          <form action={signOut}>
            <button type="submit" className="field__action">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <AdminTabs
        counts={{ pending: pendingInvites.length, people: people.length }}
        invite={<InviteConsole signupUrl={signupUrl} />}
        pending={<PendingInvites invites={pendingInvites} />}
        people={<People people={people} />}
      />
    </>
  );
}
