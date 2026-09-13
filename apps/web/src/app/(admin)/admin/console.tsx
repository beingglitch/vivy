'use client';

import { useState, useTransition } from 'react';
import type { PeriodUnit } from '@/lib/period';
import { mintInvite, type Minted } from './actions';
import { PeriodPicker } from './period';
import { ShareInvite } from './share';

/**
 * Mint an invite.
 *
 * Two different clocks here, which is easy to conflate. **Access period** is how
 * long the person gets to use Vivy once they redeem. **Code expires in** is how
 * long the code itself stays redeemable. A code good for three days can still
 * buy a year.
 */
export function InviteConsole({ signupUrl }: { signupUrl: string }) {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [codeDays, setCodeDays] = useState(14);
  const [amount, setAmount] = useState(3);
  const [unit, setUnit] = useState<PeriodUnit>('month');
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<Minted | null>(null);

  return (
    <section className="src__section">
      <div className="field">
        <div className="field__row">
          <label className="field__label" htmlFor="recipient">
            Their email
          </label>
          <span className="field__hint">Optional</span>
        </div>
        <input
          id="recipient"
          type="email"
          className="field__input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="they@example.com"
          autoComplete="off"
        />
      </div>

      <PeriodPicker
        idPrefix="invite"
        amount={amount}
        unit={unit}
        onAmount={setAmount}
        onUnit={setUnit}
        label="They get access for"
      />

      <div className="invitegrid">
        <div className="field">
          <label className="field__label" htmlFor="uses">
            Uses
          </label>
          <input
            id="uses"
            type="number"
            className="field__input"
            min={1}
            max={50}
            value={maxUses}
            onChange={(e) => setMaxUses(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="codeDays">
            Code expires in days
          </label>
          <input
            id="codeDays"
            type="number"
            className="field__input"
            min={1}
            max={90}
            value={codeDays}
            onChange={(e) => setCodeDays(Number(e.target.value))}
          />
        </div>
      </div>

      {error ? (
        <p className="auth__error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="btn btn--primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            setMinted(null);
            const result = await mintInvite(email, maxUses, codeDays, amount, unit);
            if (!result.ok) return setError(result.error);
            setMinted(result.data ?? null);
            setEmail('');
          })
        }
      >
        {pending ? 'Creating…' : 'Create invite'}
      </button>

      {minted ? <ShareInvite minted={minted} signupUrl={signupUrl} /> : null}
    </section>
  );
}
