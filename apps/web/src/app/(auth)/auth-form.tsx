'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { OtpInput } from '@/components/otp-input';
import { PassphraseField } from '@/components/passphrase-field';
import { completeSignupAction, sendCodeAction, verifyCodeAction } from './actions';

/**
 * Signup.
 *
 * Three steps in one component rather than three routes, so the invite, the
 * email and the code stay in memory instead of travelling through URLs or extra
 * cookies. Personal data does not belong in a query string, and a credential in
 * browser history outlives its window.
 */

type Step = 'email' | 'code' | 'passphrase';

export function AuthForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<Step>('email');
  const [error, setError] = useState<string | null>(null);

  const [invite, setInvite] = useState('');
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
        const result = await verifyCodeAction(email, entered);
        if (!result.ok) return setError(result.error);
        setStep('passphrase');
      });
    },
    [email],
  );

  return (
    <form
      className="auth"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 'email') {
          run(async () => {
            const result = await sendCodeAction(email, invite);
            if (!result.ok) return setError(result.error);
            setStep('code');
          });
        } else if (step === 'code') {
          verify(code);
        } else {
          run(async () => {
            const result = await completeSignupAction(email, code, invite, passphrase, confirm);
            if (result.ok) router.replace('/onboarding');
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
          {step === 'email'
            ? 'Create your Vivy'
            : step === 'code'
              ? 'Check your email'
              : 'Set a passphrase'}
        </h1>
        <p className="auth__sub">
          {step === 'email'
            ? 'Vivy is invite-only. Enter your code and we will confirm your email.'
            : step === 'code'
              ? `We sent a six-digit code to ${email}.`
              : 'This signs you in and unlocks your encrypted data. It cannot be reset, so write it down.'}
        </p>
      </header>

      {step === 'email' ? (
        <>
          <div className="field">
            <label className="field__label" htmlFor="invite">
              Invite code
            </label>
            <input
              id="invite"
              type="text"
              className="field__input"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="VIVY-XXXXX-XXXXX-…"
              autoFocus
            />
          </div>
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
            />
          </div>
        </>
      ) : null}

      {step === 'code' ? (
        <div className="field">
          <div className="field__row">
            <label className="field__label" htmlFor="otp-0">
              Six-digit code
            </label>
            <button
              type="button"
              className="field__action"
              onClick={() => {
                setStep('email');
                setCode('');
              }}
            >
              Change email
            </button>
          </div>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={verify}
            disabled={pending}
            autoFocus
          />
        </div>
      ) : null}

      {step === 'passphrase' ? (
        <>
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
              : 'Create account'}
      </button>

      {step === 'email' ? (
        <p className="auth__foot">
          Already have one?{' '}
          <Link href="/login" className="link">
            Sign in
          </Link>
        </p>
      ) : null}
    </form>
  );
}
