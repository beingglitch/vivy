'use client';

import { useState, type ReactNode } from 'react';

/**
 * Three views of the same job: hand out access, watch what is outstanding,
 * manage who has it.
 *
 * All three render on the server and are held here rather than fetched per tab.
 * The lists are tens of rows, so switching should be instant, and a loading
 * state between two tabs of the same page reads as breakage.
 */
export function AdminTabs({
  invite,
  pending,
  people,
  counts,
}: {
  invite: ReactNode;
  pending: ReactNode;
  people: ReactNode;
  counts: { pending: number; people: number };
}) {
  const [tab, setTab] = useState<'invite' | 'pending' | 'people'>('invite');

  const tabs = [
    { id: 'invite' as const, label: 'New invite' },
    { id: 'pending' as const, label: `Pending${counts.pending ? ` (${counts.pending})` : ''}` },
    { id: 'people' as const, label: `Users${counts.people ? ` (${counts.people})` : ''}` },
  ];

  return (
    <>
      <div className="seg seg--three" role="tablist" aria-label="Admin sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            className="seg__btn"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="screen screen--plain">
        {tab === 'invite' ? invite : null}
        {tab === 'pending' ? pending : null}
        {tab === 'people' ? people : null}
      </div>
    </>
  );
}
