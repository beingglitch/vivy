'use client';

import { useState, useTransition } from 'react';
import type { PairedDevice } from '@/lib/devices';
import { pair, revoke } from './pair-actions';

/**
 * Pair a phone, and show the token exactly once.
 *
 * There is no way back to it: only a hash is stored. That is deliberate, and
 * saying so on the screen is the difference between someone copying it now and
 * someone hunting for it later.
 */
export function Pairing({ devices }: { devices: PairedDevice[] }) {
  const [name, setName] = useState('pixel');
  const [issued, setIssued] = useState<{ deviceId: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      try {
        setIssued(await pair(name));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not pair.');
      }
    });
  }

  return (
    <section className="src__section">
      <span className="eyebrow">Pair this phone</span>

      {issued ? (
        <div className="pair__issued">
          <p className="pair__once">
            Copy these into the app now. The token is shown once and is not stored anywhere it can
            be read back.
          </p>
          <Field label="Server address" value={origin()} />
          <Field label="Device name" value={issued.deviceId} />
          <Field label="Pairing token" value={issued.token} />
          <button className="btn btn--quiet" onClick={() => setIssued(null)}>
            Done
          </button>
        </div>
      ) : (
        <div className="pair__form">
          <label className="field__label" htmlFor="pair-name">
            Name this phone
          </label>
          <input
            id="pair-name"
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pixel"
            autoComplete="off"
          />
          <button className="btn btn--primary" disabled={pending || !name.trim()} onClick={submit}>
            {pending ? 'Pairing...' : 'Generate pairing token'}
          </button>
          {error ? <p className="pair__error">{error}</p> : null}
        </div>
      )}

      {devices.length > 0 ? (
        <ul className="pair__list">
          {devices.map((d) => (
            <li key={d.id} className="pair__row">
              <span className="pair__rowName">{d.label}</span>
              <span className="pair__rowMeta">
                {d.lastSeenAt ? `last sent ${when(d.lastSeenAt)}` : 'never sent anything'}
              </span>
              <RevokeButton deviceId={d.id} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function RevokeButton({ deviceId }: { deviceId: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="pair__revoke" onClick={() => setConfirming(true)}>
        Unpair
      </button>
    );
  }

  return (
    <button
      className="pair__revoke pair__revoke--armed"
      disabled={pending}
      onClick={() => start(() => void revoke(deviceId))}
    >
      {pending ? 'Unpairing...' : 'Really unpair'}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="pair__field">
      <span className="pair__fieldLabel">{label}</span>
      <code className="pair__value">{value}</code>
      <button
        className="pair__copy"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** Read from the browser so the address shown is the one that actually works. */
function origin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

function when(date: Date): string {
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
