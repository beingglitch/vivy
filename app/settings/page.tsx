import { getProfile } from '@/lib/settings';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const profile = await getProfile();
  return (
    <main className="mx-auto max-w-md space-y-8">
      <div>
        <h1 className="font-voice text-2xl italic">Settings</h1>
        <p className="mt-1 text-sm text-moth">Who you are — Vivy uses this everywhere.</p>
      </div>
      <ProfileForm initial={profile} />
    </main>
  );
}
