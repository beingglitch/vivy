import { IntenseSettingsEditor } from '@/components/intense-mode';
import { Dock } from '@/components/shell';
import { intenseStateOf } from '@/lib/intense';
import { requirePageUserId } from '@/lib/page-session';

export const dynamic = 'force-dynamic';

export default async function IntenseModePage() {
  const state = await intenseStateOf(await requirePageUserId());
  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Intense Mode</h1>
            <span className="subtitle">Long-press Today to begin</span>
          </div>
        </div>
      </div>
      <div className="screen intense-settings-screen">
        <IntenseSettingsEditor initial={state.settings} />
      </div>
      <Dock />
    </>
  );
}
