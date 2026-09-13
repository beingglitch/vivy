import { Empty } from '@/components/empty';
import { MenuIcon, PlusIcon } from '@/components/icons';
import { Dock } from '@/components/shell';
import { requireUserId } from '@/lib/session';
import { hasAnyData, loadStreams } from '@/lib/streams-data';
import { StreamsScreen } from './streams-screen';

export const dynamic = 'force-dynamic';

/**
 * Home.
 *
 * Reads `metrics_daily`. A new account has none, so this is empty until a
 * collector has pushed something and the rollup has run. Showing example charts
 * instead would mean every number on the opening screen was fiction.
 */
export default async function HomePage() {
  const streams = await loadStreams(await requireUserId());
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Streams</h1>
            <span className="subtitle">{today}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="iconbtn" aria-label="Manage streams">
              <MenuIcon />
            </button>
            <button className="iconbtn iconbtn--solid" aria-label="New">
              <PlusIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="screen">
        {hasAnyData(streams) ? (
          <StreamsScreen streams={streams} />
        ) : (
          <Empty
            title="No streams yet"
            hint="Connect a device in More → Sources. Charts appear once it starts sending."
          />
        )}
      </div>

      <Dock />
    </>
  );
}
