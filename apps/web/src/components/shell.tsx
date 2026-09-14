'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { HomeIcon, MicIcon, MoneyIcon, MoreIcon, QuadrantIcon, SendIcon, TodayIcon } from './icons';

/**
 * The persistent chrome: status bar, capture composer, tab bar.
 *
 * The composer sits above the tab bar on every screen rather than taking a tab
 * slot, which is what keeps capture one thumb-reach away, the whole premise of
 * a chat-first tracker. Both float over the scroll region on a white gradient,
 * so content scrolls under them instead of being clipped by them.
 *
 * There is deliberately no status bar. The design canvas drew one because a
 * mockup has to draw the whole phone, but on a real phone it is a second fake
 * clock sitting under the real one.
 */

const TABS = [
  { href: '/', label: 'Home', Icon: HomeIcon },
  { href: '/today', label: 'Today', Icon: TodayIcon },
  { href: '/quadrant', label: 'Quadrant', Icon: QuadrantIcon },
  { href: '/money', label: 'Money', Icon: MoneyIcon },
  { href: '/more', label: 'More', Icon: MoreIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map(({ href, label, Icon }) => {
        // `/` must match exactly, or it would light up on every route.
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className="tab" aria-current={active ? 'page' : undefined}>
            <span className="tab__icon">
              <Icon />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Capture bar.
 *
 * Typing turns the mic into a send button, the design shows both states, and
 * showing send on an empty field would offer an action that does nothing.
 */
export function Composer({
  placeholder = 'Tell Vivy…',
  onSubmit,
}: {
  placeholder?: string;
  /**
   * What to do with the typed text. Without one the field still clears, which
   * keeps it honest until the chat endpoint lands: a bar that swallows input
   * and reloads the page is worse than one that visibly does nothing.
   */
  onSubmit?: (text: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const hasText = value.trim().length > 0;

  return (
    <form
      className={`composer${hasText ? ' composer--active' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        const text = value.trim();
        if (!text || busy) return;
        // Cleared first so the field is ready for the next thought rather than
        // blocked on a round trip.
        setValue('');
        if (!onSubmit) return;
        setBusy(true);
        void Promise.resolve(onSubmit(text)).finally(() => setBusy(false));
      }}
    >
      <input
        className="composer__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {hasText ? (
        <button type="submit" className="composer__btn composer__btn--solid" aria-label="Send">
          <SendIcon />
        </button>
      ) : (
        <button type="button" className="composer__btn composer__btn--solid" aria-label="Speak">
          <MicIcon />
        </button>
      )}
    </form>
  );
}

export function Dock({ children }: { children?: React.ReactNode }) {
  return (
    <div className="dock">
      {children}
      <Composer />
      <TabBar />
    </div>
  );
}
