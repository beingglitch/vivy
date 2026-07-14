'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Calendar is the planner's ground truth: Vivy reads what's fixed tomorrow and
// (on confirm) writes [vivy] blocks back. Connect once; token lives server-side.
export function GoogleCard({
  connected,
  email,
  configured,
}: {
  connected: boolean;
  email: string | null;
  configured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-xl border border-seam bg-veil p-4">
      <p className="text-xs font-medium tracking-widest text-moth uppercase">Google Calendar</p>
      {!configured && (
        <p className="mt-2 text-sm text-moth">
          Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in the environment first (see SPEC-0010).
        </p>
      )}
      {configured && !connected && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-moth">
            Lets the planner see tomorrow&apos;s events and place work blocks on your calendar.
          </p>
          <a
            href="/api/google/auth"
            className="inline-block rounded-lg bg-ember px-4 py-2 text-sm font-medium text-night"
          >
            Connect Google Calendar
          </a>
        </div>
      )}
      {configured && connected && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-linen/90">
            Connected{email ? ` as ${email}` : ''} <span className="text-sage">✓</span>
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await fetch('/api/google/disconnect', { method: 'POST' });
              setBusy(false);
              router.refresh();
            }}
            className="text-xs text-moth hover:text-rose disabled:opacity-50"
          >
            disconnect
          </button>
        </div>
      )}
    </section>
  );
}
