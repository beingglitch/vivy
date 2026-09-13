'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { OtpInput } from '@/components/otp-input';
import { PassphraseField } from '@/components/passphrase-field';
import { completeResetAction, sendResetCodeAction, verifyResetCodeAction } from './reset-actions';

/**
 * Passphrase reset.
 *
 * The warning on the last step is the important part of this screen. A reset
 * restores the account, every chart, task, total and setting, but it cannot
 * restore the key that decrypts sealed raw data, because that key was derived
 * from the passphrase being replaced.
 *
 * Nothing is sealed yet, so today this costs nothing. Saying so now means nobody
 * is surprised later.
 */

type Step = 'email' | 'code' | 'passphrase';

export function ResetForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<Step>('email');
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');

  function run(fn: () => Promise<void>) {
    setError(null);
    start(() => void fn());
  }

  const verify = useCallback(
    (entered: string) => {
      run(async () => {
        const result = await verifyResetCodeAction(email, entered);
        if (!result.ok) return setError(result.error);
        setStep('passphrase');
      });
    },
    [email]);

  return (
    <form
      className="auth"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 'email') {
          run(async () => {
            const result = await sendResetCodeAction(email);
            if (!result.ok) return setError(result.error);
            setStep('code');
          });
        } else if (step === 'code') {
          verify(code);
        } else {
          run(async () => {
            const result = await completeResetAction(email, code, passphrase, confirm);
            if (result.ok) router.replace('/');
            else setError(result.error);
          });
        }
      }}
    >
      <header className="auth__head">
        <span className="auth__mark" aria-hidden>
          V
        </span>
        <h1 className="auth__title">
          {step === 'passphrase' ? 'Choose a new passphrase' : 'Reset your passphrase'}
        </h1>
        <p className="auth__sub">
          {step === 'email'
            ? 'We send a six-digit code to confirm the address is yours.'
            : step === 'code'
              ? `If ${email} has an account, a code is on its way.`
              : 'This replaces your old passphrase and signs out your other devices.'}
        </p>
      </header>

      {step === 'email' ? (
        <div className="field">
          <label className="field__label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="field__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
            autoFocus
          />
        </div>
      ) : null}

      {step === 'code' ? (
        <div className="field">
          <label className="field__label" htmlFor="otp-0">
            Six-digit code
          </label>
          <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={pending} autoFocus />
        </div>
      ) : null}

      {step === 'passphrase' ? (
        <>
          <PassphraseField
            id="passphrase"
            label="New passphrase"
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
          <p className="auth__warn">
            <strong>What a reset cannot recover.</strong> Your old passphrase derived the key for
            encrypted raw data. Replacing it gets your account back, every chart, task and total, but anything already sealed stays locked. Nothing is sealed yet, so today this costs you
            nothing.
          </p>
        </>
      ) : null}

      {error ? (
        <p className="auth__error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="auth__submit" disabled={pending}>
        {pending
          ? 'Working…'
          : step === 'email'
            ? 'Send code'
            : step === 'code'
              ? 'Verify'
              : 'Set new passphrase'}
      </button>

      <p className="auth__foot">
        Remembered it?{' '}
        <Link href="/login" className="link">
          Sign in
        </Link>
      </p>
    </form>
  );
}
