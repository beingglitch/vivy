import { Dock } from '@/components/shell';

export const dynamic = 'force-dynamic';

/**
 * Quadrant.
 *
 * The grid is drawn whether or not anything sits in it. It is the structure of
 * the screen rather than a chart that needs data: the labelled axes and the
 * tinted corner are what explain the idea, so an empty grid teaches where work
 * will land. Hiding it leaves nothing to read.
 *
 * Tasks plot as dots once a tasks table exists. There is none yet.
 */
export default function QuadrantPage() {
  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Quadrant</h1>
            <span className="subtitle">Nothing open</span>
          </div>
        </div>
      </div>

      <div className="screen screen--flush">
        <div style={{ padding: '0 20px', display: 'flex', gap: 8 }}>
          <div className="axis-y">
            <span>Important + due</span>
          </div>
          <div className="quadrant">
            {/* Top-left is tinted: important and quick, the place to look first. */}
            <div className="quadrant__hot" />
            <div className="quadrant__vline" />
            <div className="quadrant__hline" />
          </div>
        </div>

        <div className="axis-x">
          <span>5 min</span>
          <span className="axis-x__label">Time to finish</span>
          <span>4 h +</span>
        </div>

        <p className="quadrant__note">
          Open tasks appear here as dots, placed by how important they are against how long they
          take. Bigger dot, longer job.
        </p>
      </div>

      <Dock />
    </>
  );
}
