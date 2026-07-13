'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Phone navigation: a fixed bottom tab bar (thumb reach) instead of the
// scrolling top nav. Chat lives in the floating Vivy button. Hidden on sm+.

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const tabs = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke} aria-hidden>
        <path d="M4 11.5 12 5l8 6.5M6 10v9h12v-9" />
      </svg>
    ),
  },
  {
    href: '/tasks',
    label: 'Tasks',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke} aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m8.5 12.2 2.4 2.4 4.6-5" />
      </svg>
    ),
  },
  {
    href: '/learning',
    label: 'Learn',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke} aria-hidden>
        <path d="M12 6.5C10.5 5 8.5 4.5 5 4.5v13c3.5 0 5.5.5 7 2 1.5-1.5 3.5-2 7-2v-13c-3.5 0-5.5.5-7 2Zm0 0v13" />
      </svg>
    ),
  },
  {
    href: '/finance',
    label: 'Money',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke} aria-hidden>
        <path d="M6.5 4.5h11M6.5 8.5h11M6.5 8.5c4 0 6 1.5 6 4s-2 4-5 4l6.5 3M13 4.5c1 1 1.5 2.3 1.5 4" />
      </svg>
    ),
  },
  {
    href: '/browsing',
    label: 'Browse',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke} aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c-2.3 2.3-3.5 5.2-3.5 8.5s1.2 6.2 3.5 8.5c2.3-2.3 3.5-5.2 3.5-8.5S14.3 5.8 12 3.5Z" />
      </svg>
    ),
  },
];

export function MobileTabs() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-seam/80 bg-night/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <div className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                active ? 'text-ember' : 'text-moth hover:text-linen'
              }`}
            >
              {t.icon}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
