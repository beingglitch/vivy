'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Header bell: unread count fetched client-side so the (server) layout stays
// out of the request path. Visiting /notifications clears it.
export function NotificationsBell() {
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/notifications?unread=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setUnread(j?.unread ?? 0))
      .catch(() => {});
  }, [pathname]);

  return (
    <Link
      href="/notifications"
      title="Notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      className="relative text-moth transition-colors hover:text-linen"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-4.5 w-4.5"
        aria-hidden
      >
        <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17s-2.5-1-2.5-7" strokeLinejoin="round" />
        <path d="M10 19a2.2 2.2 0 0 0 4 0" strokeLinecap="round" />
      </svg>
      {unread > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-ember px-1 font-mono text-[9px] leading-none font-medium text-night"
          aria-hidden
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
