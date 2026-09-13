import Link from 'next/link';
import { ChevronIcon } from '@/components/icons';
import { Dock } from '@/components/shell';

export const dynamic = 'force-dynamic';

/**
 * More.
 *
 * The canvas names three things behind this tab. Activity, Learning, Focus
 * areas, but only draws Focus areas. The other two are listed and marked, not
 * invented: a screen built without a design would be a guess wearing the same
 * typeface as the real ones.
 */
const ITEMS = [
  { href: '/more/areas', label: 'Focus areas', note: 'none yet', ready: true },
  { href: '/more/sources', label: 'Sources', note: 'connect your devices', ready: true },
  { href: '/more/settings', label: 'Settings', note: 'sign-in and account', ready: true },
  { href: null, label: 'Activity', note: 'not designed yet', ready: false },
  { href: null, label: 'Learning', note: 'not designed yet', ready: false },
] as const;

export default async function MorePage() {
  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">More</h1>
          </div>
        </div>
      </div>

      <div className="screen">
        {ITEMS.map((item) => {
          const body = (
            <>
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.2px' }}>
                {item.label}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12.5, color: 'var(--grey-5)' }}>{item.note}</span>
              {item.ready ? <ChevronIcon /> : null}
            </>
          );

          const style = {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '15px 20px',
            borderTop: '1px solid var(--line-1)',
            textAlign: 'left' as const,
            opacity: item.ready ? 1 : 0.45,
          };

          return item.href ? (
            <Link key={item.label} href={item.href} style={style}>
              {body}
            </Link>
          ) : (
            <div key={item.label} style={style}>
              {body}
            </div>
          );
        })}

        <Link
          href="/status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '15px 20px',
            borderTop: '1px solid var(--line-1)',
            marginTop: 24,
            color: 'var(--grey-5)',
            fontSize: 13,
          }}
        >
          Ingest status
          <span style={{ flex: 1 }} />
          <ChevronIcon />
        </Link>
      </div>

      <Dock />
    </>
  );
}
