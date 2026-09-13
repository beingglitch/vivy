'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PassphraseField } from '@/components/passphrase-field';
import { savePassphrase } from '@/app/(app)/more/settings/actions';

/**
 * Reuses the Settings action rather than duplicating one, so the two places a
 * passphrase can be set cannot drift into different validation.
 */
export function SetPassphraseForm({ email, next }: { email: string; next: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flow__body">
      <form
        className="auth"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null);
            const result = await savePassphrase(passphrase, confirm);
            if (result.ok) router.replace(next as Parameters<typeof router.replace>[0]);
            else setError(result.error);
          });
        }}
      >
        <header className="auth__head">
          <span className="auth__mark" aria-hidden>
            V
          </span>
          <h1 className="auth__title">You&apos;re admin!</h1>
          <p className="auth__sub">Signed in as {email}.</p>
        </header>

        <PassphraseField
          id="passphrase"
          label="Passphrase"
          value={passphrase}
          onChange={setPassphrase}
          autoComplete="new-password"
          placeholder="At least 12 characters"
          hint={`${passphrase.length}/12`}
          autoFocus
        />
        <PassphraseField
          id="confirm"
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

        <button type="submit" className="auth__submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </div>
  );
}
