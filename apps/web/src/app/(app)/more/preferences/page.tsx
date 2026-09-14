import { Dock } from '@/components/shell';
import { requirePageUserId } from '@/lib/page-session';
import { profileOf } from '@/lib/profile';
import { AccentPicker } from './accent-picker';

export const dynamic = 'force-dynamic';

export default async function PreferencesPage() {
  const profile = await profileOf(await requirePageUserId());
  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Preferences</h1>
            <span className="subtitle">Appearance across your devices</span>
          </div>
        </div>
      </div>
      <div className="screen">
        <section className="src__section">
          <span className="eyebrow">Accent colour</span>
          <p className="src__controlNote">
            Used for primary buttons, selected controls and navigation highlights.
          </p>
          <AccentPicker current={profile.accentColour} />
        </section>
      </div>
      <Dock />
    </>
  );
}
