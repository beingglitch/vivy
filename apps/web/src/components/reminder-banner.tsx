'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { skipStep } from '@/app/(flow)/onboarding/actions';

/**
 * The in-app half of "remind me later".
 *
 * A web push notification can be declined, cleared, or never permitted, so the
 * reminder cannot live only there, this bar is the guaranteed path. Both routes
 * lead to the same place: the source's setup page.
 *
 * Dismissing it marks the source skipped rather than hiding the bar, because a
 * reminder you have now consciously waved away twice should stop returning.
 */
export function ReminderBanner({ name, sourceId }: { name: string; sourceId: string }) {
  const [pending, start] = useTransition();

  return (
    <div className="remind">
      <span className="dot dot--sm" style={{ background: 'var(--amber)' }} />
      <Link href={`/more/sources/${sourceId}`} className="remind__text">
        You asked to be reminded about <strong>{name}</strong>
      </Link>
      <button
        className="remind__x"
        aria-label={`Stop reminding me about ${name}`}
        disabled={pending}
        onClick={() => start(() => void skipStep(sourceId))}
      >
        ✕
      </button>
    </div>
  );
}
