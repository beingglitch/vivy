'use client';

import { useEffect, useState } from 'react';

/**
 * Notification permission, asked for at the moment it earns the right.
 *
 * Never on load: a permission prompt before the user has expressed any interest
 * is the fastest way to get permanently denied, and a denied permission cannot
 * be re-requested from the page. So this renders as an explanatory control, and
 * the browser prompt only appears after a deliberate tap.
 */

type State = 'unsupported' | 'default' | 'granted' | 'denied' | 'working';

/**
 * VAPID keys travel as base64url; `applicationServerKey` wants raw bytes.
 *
 * Backed by an explicitly allocated ArrayBuffer rather than `Uint8Array.from`,
 * because TypeScript 5.7 made Uint8Array generic over its buffer and only a view
 * on a real ArrayBuffer satisfies `BufferSource`.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);

  const view = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

export function PushToggle({ publicKey }: { publicKey: string | undefined }) {
  const [state, setState] = useState<State>('default');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !publicKey) {
      setState('unsupported');
      return;
    }
    setState(Notification.permission as State);
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setState('working');

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission as State);
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          // Chrome requires this to be true and will reject silent pushes.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      setState(response.ok ? 'granted' : 'default');
    } catch {
      setState('default');
    }
  }

  if (state === 'unsupported') {
    return (
      <p className="src__controlNote">
        This browser cannot show notifications. The in-app reminder bar still works.
      </p>
    );
  }

  if (state === 'granted') {
    return <p className="src__controlNote">Notifications are on for this device.</p>;
  }

  if (state === 'denied') {
    return (
      <p className="src__controlNote">
        Notifications are blocked for this site. Turn them back on in your browser&apos;s site
        settings. a page cannot ask again once denied.
      </p>
    );
  }

  return (
    <>
      <button className="btn" disabled={state === 'working'} onClick={() => void enable()}>
        {state === 'working' ? 'Asking…' : 'Turn on notifications'}
      </button>
      <p className="src__controlNote">
        Lets a scheduled reminder reach you with Vivy closed. Without it, reminders only appear as a
        bar inside the app.
      </p>
    </>
  );
}
