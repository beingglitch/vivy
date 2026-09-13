'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  HomeIcon,
  MicIcon,
  MoneyIcon,
  MoreIcon,
  QuadrantIcon,
  SendIcon,
  TodayIcon,
} from './icons';

/**
 * The persistent chrome: status bar, capture composer, tab bar.
 *
 * The composer sits above the tab bar on every screen rather than taking a tab
 * slot, which is what keeps capture one thumb-reach away, the whole premise of
 * a chat-first tracker. Both float over the scroll region on a white gradient,
 * so content scrolls under them instead of being clipped by them.
 */

export function StatusBar() {
  // Rendered on the client only. A server-rendered clock hydrates into a
  // mismatch the moment the minute rolls over between render and paint.
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="statusbar">
      <span className="statusbar__time">{time ?? ' '}</span>
      <div className="statusbar__right">
        <div className="statusbar__bars" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="statusbar__battery" aria-hidden>
          <span />
        </div>
      </div>
    </div>
  );
}

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
            <Icon />
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
