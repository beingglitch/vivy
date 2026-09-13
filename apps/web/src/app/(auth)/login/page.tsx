import { redirect } from 'next/navigation';
import { LoginForm } from '../login-form';
import { currentUserId, lastLoginMethod } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * The default tab comes from a cookie written at the last successful login,
 * which mirrors the account's stored preference. The page cannot read that
 * preference directly, it does not know who is signing in yet.
 */
export default async function LoginPage() {
  if (await currentUserId()) redirect('/');
  return (
    <div className="board">
      <div className="phone phone--auth">
        <LoginForm initialMethod={await lastLoginMethod()} />
      </div>
    </div>
  );
}
