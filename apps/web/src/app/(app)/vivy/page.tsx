import { Empty } from '@/components/empty';
import { Composer, TabBar } from '@/components/shell';

export const dynamic = 'force-dynamic';

/**
 * Vivy.
 *
 * The composer is live in the sense that it accepts typing; nothing is wired to
 * the tool layer yet, so no conversation exists to show.
 */
export default function VivyPage() {
  return (
    <>
      <div className="header">
        <div className="header__row">
          <h1 className="title">Vivy</h1>
        </div>
      </div>

      <div className="screen screen--flush">
        <Empty
          title="Nothing said yet"
          hint="Tell Vivy what you spent, finished or read, and it files it for you."
        />
      </div>

      <div className="dock">
        <Composer />
        <TabBar />
      </div>
    </>
  );
}
