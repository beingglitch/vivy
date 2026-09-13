import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { currentAdmin } from '@/lib/admin';
import { hasPassphrase } from '@/lib/session';

/**
 * The admin shell.
 *
 * No tab bar and no composer, because an admin account is not a Vivy user. It
 * exists to hand out invites and nothing else, so giving it Home, Today and
 * Money would be showing five empty screens it can never fill.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) redirect('/login');
  if (!(await hasPassphrase(admin.id))) redirect('/set-passphrase');

  return (
    <div className="board">
      <div className="phone">
        {children}
      </div>
    </div>
  );
}
