import Link from 'next/link';
import type { Route } from 'next';
import { ChevronIcon } from '@/components/icons';
import { Dock } from '@/components/shell';

export const dynamic = 'force-dynamic';

const MAIN_ITEMS = [
  { href: null, label: 'Habit / Recurring', note: 'coming soon' },
  { href: null, label: 'Health', note: 'coming soon' },
  { href: '/more/intense', label: 'Intense Mode', note: 'focus timer' },
  { href: null, label: 'Activity', note: 'coming soon' },
] as const;

const SYSTEM_ITEMS = [
  { href: '/more/sources', label: 'Ingestors', note: 'connect your devices' },
  { href: '/more/settings', label: 'Security', note: 'passphrase and sign-in' },
  { href: '/more/user', label: 'User', note: 'name and profile' },
  { href: '/more/preferences', label: 'Preferences', note: 'appearance and accent' },
] as const;

export default function MorePage() {
  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">More</h1>
          </div>
        </div>
      </div>

      <div className="screen screen--flush more-menu">
        <MoreGroup items={MAIN_ITEMS} />
        <MoreGroup items={SYSTEM_ITEMS} separated />
      </div>

      <Dock />
    </>
  );
}

function MoreGroup({
  items,
  separated = false,
}: {
  items: ReadonlyArray<{ href: Route | null; label: string; note: string }>;
  separated?: boolean;
}) {
  return (
    <section className={`more-menu__group${separated ? ' more-menu__group--separated' : ''}`}>
      {items.map((item) => {
        const content = (
          <>
            <strong>{item.label}</strong>
            <span>{item.note}</span>
            {item.href ? <ChevronIcon /> : null}
          </>
        );

        return item.href ? (
          <Link className="more-menu__row" href={item.href} key={item.label}>
            {content}
          </Link>
        ) : (
          <div className="more-menu__row more-menu__row--disabled" key={item.label}>
            {content}
          </div>
        );
      })}
    </section>
  );
}
