import { redirect } from 'next/navigation';
import { AuthForm } from '../auth-form';
import { currentUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  if (await currentUserId()) redirect('/');
  return (
    <div className="board">
      <div className="phone phone--auth">
        <AuthForm />
      </div>
    </div>
  );
}
