'use client';

import { useState, useTransition } from 'react';
import { PassphraseField } from '@/components/passphrase-field';
import { savePassphrase } from './actions';

/**
 * Add or change a passphrase.
 *
 * An account provisioned from the admin allowlist never had one, so this is not
 * an edge case for those users, it is the only way they get sealed streams at
 * all. The copy says what is currently locked rather than just offering a form.
 */
export function PassphrasePanel({ hasOne }: { hasOne: boolean }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!open) {
    return (
      <>
        <p className="src__controlNote">
          {hasOne
            ? 'Set. You can sign in with it, and it unlocks encrypted raw data on this device.'
            : 'Not set yet. Finish setting one to unlock encrypted raw data.'}
        </p>
        <button className={hasOne ? 'btn' : 'btn btn--primary'} onClick={() => setOpen(true)}>
          {hasOne ? 'Change passphrase' : 'Add a passphrase'}
        </button>
        {saved ? <p className="src__controlNote">Saved.</p> : null}
      </>
    );
  }

  return (
    <>
      <PassphraseField
        id="new-passphrase"
        label={hasOne ? 'New passphrase' : 'Passphrase'}
        value={passphrase}
        onChange={setPassphrase}
        autoComplete="new-password"
        placeholder="At least 12 characters"
        hint={`${passphrase.length}/12`}
        autoFocus
      />
      <PassphraseField
        id="new-confirm"
        label="Again"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

      {error ? (
        <p className="auth__error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="src__controlNote">
        It cannot be recovered, only replaced from your email. Write it down.
      </p>

      <button
        className="btn btn--primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await savePassphrase(passphrase, confirm);
            if (!result.ok) return setError(result.error);
            setPassphrase('');
            setConfirm('');
            setSaved(true);
            setOpen(false);
          })
        }
      >
        {pending ? 'Saving…' : 'Save passphrase'}
      </button>
      <button
        className="btn btn--quiet"
        onClick={() => {
          setOpen(false);
          setError(null);
          setPassphrase('');
          setConfirm('');
        }}
      >
        Cancel
      </button>
    </>
  );
}
