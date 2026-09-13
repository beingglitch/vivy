import { Empty } from '@/components/empty';
import { Composer, TabBar } from '@/components/shell';

export const dynamic = 'force-dynamic';

/**
 * Today.
 *
 * Empty on a new account, and empty for everyone right now: there is no tasks
 * table yet, so there is nothing to read. When one exists this reads it and the
 * empty state becomes the genuinely-nothing-today case.
 */
export default function TodayPage() {
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
            <h1 className="title">Today</h1>
            <span className="subtitle">{today}</span>
          </div>
        </div>
      </div>

      <div className="screen screen--flush">
        <Empty title="Nothing planned" hint="Tasks you add will show here, grouped by focus area." />
      </div>

      <div className="dock">
        <Composer placeholder="Add or complete a task…" />
        <TabBar />
      </div>
    </>
  );
}
