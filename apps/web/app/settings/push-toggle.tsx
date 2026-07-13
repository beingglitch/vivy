'use client';

import { useEffect, useState } from 'react';

// Web push opt-in. One tap: register the service worker, ask permission,
// subscribe with the VAPID key, save the subscription server-side.
type State = 'loading' | 'unsupported' | 'denied' | 'off' | 'on';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushToggle() {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        setState('denied');
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setNote('');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setNote('VAPID key missing on this deployment.');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setState('on');
      setNote('This device will now get nudges.');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'subscribe failed');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setNote('');
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setState('off');
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true);
    const res = await fetch('/api/push/test', { method: 'POST' });
    const j = await res.json().catch(() => null);
    setNote(j?.sent ? `Sent to ${j.sent} device(s).` : 'Nothing sent — check the subscription.');
    setBusy(false);
  }

  return (
    <section className="space-y-3 rounded-xl border border-seam bg-veil/50 p-4">
      <div>
        <h2 className="text-sm font-medium text-linen">Notifications</h2>
        <p className="mt-1 text-xs text-moth">
          Morning brief, spending checks, evening review — pushed to this device.
        </p>
      </div>
      {state === 'loading' && <p className="text-xs text-moth">checking…</p>}
      {state === 'unsupported' && (
        <p className="text-xs text-moth">This browser doesn&apos;t support web push.</p>
      )}
      {state === 'denied' && (
        <p className="text-xs text-rose">
          Notifications are blocked for Vivy in this browser — allow them in site settings, then reload.
        </p>
      )}
      {state === 'off' && (
        <button
          onClick={enable}
          disabled={busy}
          className="rounded-lg bg-ember px-4 py-2 text-sm font-medium text-night transition hover:brightness-110 disabled:opacity-50"
        >
          Enable on this device
        </button>
      )}
      {state === 'on' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-sage">✓ enabled on this device</span>
          <button
            onClick={sendTest}
            disabled={busy}
            className="rounded-lg border border-seam px-3 py-1.5 text-xs text-linen transition-colors hover:border-ember/60 disabled:opacity-50"
          >
            send a test
          </button>
          <button
            onClick={disable}
            disabled={busy}
            className="text-xs text-moth transition-colors hover:text-rose"
          >
            turn off
          </button>
        </div>
      )}
      {note && <p className="text-xs text-moth">{note}</p>}
    </section>
  );
}
