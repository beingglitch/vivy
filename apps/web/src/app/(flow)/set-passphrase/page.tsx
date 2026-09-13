import { redirect } from 'next/navigation';
import { currentUser, currentUserId, hasPassphrase } from '@/lib/session';
import { currentAdmin } from '@/lib/admin';
import { SetPassphraseForm } from './form';

export const dynamic = 'force-dynamic';

/**
 * The step an allowlisted account lands on the first time it signs in.
 *
 * Being named in the environment authorises the account, so there is no signup
 * form. But the passphrase still has to be collected, because it derives the key
 * for sealed streams and nothing else can. Asking for it here rather than before
 * sign-in is the whole difference: authorisation is already settled, so this is
 * one field rather than a registration.
 *
 * There is no skip. An account without a passphrase can never open sealed data,
 * and discovering that months later, with the data already captured, is not a
 * trade worth offering.
 */
export default async function SetPassphrasePage() {
  const userId = await currentUserId();
  if (!userId) redirect('/login');
  const admin = await currentAdmin();
  const next = admin ? '/admin' : '/onboarding';
  if (await hasPassphrase(userId)) redirect(next);

  const user = await currentUser();

  return <SetPassphraseForm email={user?.email ?? ''} next={next} />;
}
