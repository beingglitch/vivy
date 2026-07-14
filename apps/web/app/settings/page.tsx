import { getProfile } from '@/lib/settings';
import { googleConnection, googleConfigured } from '@/lib/google';
import { ProfileForm } from './profile-form';
import { PushToggle } from './push-toggle';
import { AppsCard } from './apps-card';
import { GoogleCard } from './google-card';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [profile, google] = await Promise.all([getProfile(), googleConnection()]);
  return (
    <main className="mx-auto max-w-md space-y-8">
      <div>
        <h1 className="font-voice text-2xl italic">Settings</h1>
        <p className="mt-1 text-sm text-moth">Who you are — Vivy uses this everywhere.</p>
      </div>
      <ProfileForm initial={profile} />
      <GoogleCard
        connected={Boolean(google)}
        email={google?.accountEmail ?? null}
        configured={googleConfigured()}
      />
      <PushToggle />
      <AppsCard />
    </main>
  );
}
