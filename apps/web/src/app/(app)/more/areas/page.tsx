import { Empty } from '@/components/empty';
import { PlusIcon } from '@/components/icons';
import { Dock } from '@/components/shell';

export const dynamic = 'force-dynamic';

/**
 * Focus areas.
 *
 * Areas group tasks and give each stream its cadence and colour. None exist on a
 * new account.
 */
export default function AreasPage() {
  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Focus areas</h1>
            <span className="subtitle">None yet</span>
          </div>
          <button className="iconbtn" aria-label="New area">
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="screen">
        <Empty
          title="No focus areas"
          hint="Areas group your work and give each one a cadence, so Vivy can tell when something has gone cold."
        />
      </div>

      <Dock />
    </>
  );
}
