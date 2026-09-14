import { Dock } from '@/components/shell';
import { requirePageUserId } from '@/lib/page-session';
import { profileOf } from '@/lib/profile';
import { UserForm } from './user-form';

export const dynamic = 'force-dynamic';

export default async function UserPage() {
  const profile = await profileOf(await requirePageUserId());
  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">User</h1>
            <span className="subtitle">{profile.email}</span>
          </div>
        </div>
      </div>
      <div className="screen">
        <section className="src__section">
          <span className="eyebrow">Profile</span>
          <UserForm current={profile.displayName ?? ''} />
        </section>
      </div>
      <Dock />
    </>
  );
}
