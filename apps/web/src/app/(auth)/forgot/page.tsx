import { redirect } from 'next/navigation';
import { ResetForm } from '../reset-form';
import { currentUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ForgotPage() {
  if (await currentUserId()) redirect('/');
  return (
    <div className="board">
      <div className="phone phone--auth">
        <ResetForm />
      </div>
    </div>
  );
}
