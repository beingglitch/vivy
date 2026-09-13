'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { OtpInput } from '@/components/otp-input';
import { PassphraseField } from '@/components/passphrase-field';
import { emailLoginAction, passphraseLoginAction, sendLoginCodeAction } from './login-actions';

/**
 * Sign in, two ways.
 *
 * Switching method swaps one field, passphrase becomes the code boxes, rather
 * than replacing the screen. The email you typed survives the switch, which is
 * the whole reason to keep the page in place.
 *
 * The tab that opens first comes from a cookie written at the last successful
 * login, mirroring the account's stored preference. The screen cannot read that
 * preference directly; it does not know who is signing in yet.
 */

type Method = 'passphrase' | 'email';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ initialMethod }: { initialMethod: Method }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<Method>(initialMethod);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  function run(fn: () => Promise<void>) {
    setError(null);
    start(() => void fn());
  }

  const sendCode = useCallback(
    (to: string) => {
      run(async () => {
        const result = await sendLoginCodeAction(to);
        if (!result.ok) return setError(result.error);
        setCodeSent(true);
      });
    },
    // `email` is passed in rather than closed over, so switching tabs can send
    // before this callback has been recreated with the current value.
    []);

  /**
   * Switching to the code tab sends the code, when there is somewhere to send
   * it. Asking someone to press "Send code" immediately after choosing "Email
   * code" is the same instruction twice.
   */
  function switchTo(next: Method) {
    setMethod(next);
    setError(null);
    setCodeSent(false);
    setCode('');

    if (next === 'email' && EMAIL.test(email.trim())) sendCode(email.trim());
  }

  const signInWithCode = useCallback(
    (entered: string) => {
      run(async () => {
        const result = await emailLoginAction(email, entered);
        if (result.ok) router.replace('/');
        else setError(result.error);
      });
    },
    [email, router]);

  const showCodeBoxes = method === 'email' && codeSent;

  return (
    <form
      className="auth"
      onSubmit={(e) => {
        e.preventDefault();
        if (method === 'passphrase') {
          run(async () => {
            const result = await passphraseLoginAction(email, passphrase);
            if (result.ok) router.replace('/');
            else setError(result.error);
          });
        } else if (!codeSent) {
          sendCode(email.trim());
        } else {
          signInWithCode(code);
        }
      }}
    >
      <header className="auth__head">
        <span className="auth__mark" aria-hidden>
          V
        </span>
        <h1 className="auth__title">Welcome back</h1>
        <p className="auth__sub">Choose how to sign in.</p>
      </header>

      <div className="seg" role="tablist" aria-label="Sign-in method">
        <button
          type="button"
          role="tab"
          className="seg__btn"
          aria-selected={method === 'passphrase'}
          onClick={() => switchTo('passphrase')}
        >
          Passphrase
        </button>
        <button
          type="button"
          role="tab"
          className="seg__btn"
          aria-selected={method === 'email'}
          onClick={() => switchTo('email')}
        >
          Email code
        </button>
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
          readOnly={codeSent}
          autoFocus={!codeSent}
        />
      </div>

      {method === 'passphrase' ? (
        <PassphraseField
          id="passphrase"
          label="Passphrase"
          value={passphrase}
          onChange={setPassphrase}
          placeholder="Your passphrase"
        />
      ) : null}

      {showCodeBoxes ? (
        <div className="field">
          <div className="field__row">
            <label className="field__label" htmlFor="otp-0">
              Code sent to {email}
            </label>
            <button
              type="button"
              className="field__action"
              onClick={() => sendCode(email.trim())}
              disabled={pending}
            >
              Resend
            </button>
          </div>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={signInWithCode}
            disabled={pending}
            autoFocus
          />
        </div>
      ) : null}

      {method === 'email' && !codeSent ? (
        <p className="auth__note">
          A code unlocks everything except encrypted raw data, that needs your passphrase.
        </p>
      ) : null}

      {error ? (
        <p className="auth__error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="auth__submit" disabled={pending}>
        {pending
          ? 'Working…'
          : method === 'passphrase'
            ? 'Unlock'
            : codeSent
              ? 'Sign in'
              : 'Send code'}
      </button>

      <p className="auth__foot">
        {method === 'passphrase' ? (
          <>
            <Link href="/forgot" className="link">
              Forgot passphrase?
            </Link>
            <span className="auth__sep">·</span>
          </>
        ) : null}
        No account?{' '}
        <Link href="/signup" className="link">
          Create one
        </Link>
      </p>
    </form>
  );
}
