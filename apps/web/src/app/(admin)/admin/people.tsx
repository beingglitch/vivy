'use client';

import { useState, useTransition } from 'react';
import type { PeriodUnit } from '@/lib/period';
import type { Person } from '@/lib/people';
import { extendPerson, movePerson, setPersonStatus } from './actions';
import { PeriodPicker } from './period';

/**
 * Everyone who has ever redeemed a code.
 *
 * The row stays whatever its state: expired accounts are not hidden, because the
 * whole reason for keeping them is that reactivating is one tap and nothing was
 * lost.
 */
export function People({ people }: { people: Person[] }) {
  if (people.length === 0) {
    return (
      <section className="src__section">
        <p className="src__controlNote">
          Nobody has redeemed a code yet. Admin accounts are not listed, they have no access period
          to manage.
        </p>
      </section>
    );
  }

  return (
    <section className="src__section">
      {people.map((person) => (
        <PersonRow key={person.id} person={person} />
      ))}
    </section>
  );
}

function stateOf(person: Person): { label: string; tone: string; allowed: boolean } {
  if (person.status === 'stopped') return { label: 'stopped', tone: '', allowed: false };
  if (!person.accessExpiresAt) return { label: 'no access', tone: '', allowed: false };
  if (person.accessExpiresAt <= new Date()) return { label: 'expired', tone: '', allowed: false };
  return { label: 'active', tone: ' srcpill--on', allowed: true };
}

function PersonRow({ person }: { person: Person }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(3);
  const [unit, setUnit] = useState<PeriodUnit>('month');
  const [moveTo, setMoveTo] = useState('');
  const [showMove, setShowMove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const state = stateOf(person);
  const until = person.accessExpiresAt?.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="person">
      <button className="person__head" onClick={() => setOpen((v) => !v)}>
        <span className="person__email">{person.email}</span>
        <span className={`srcpill${state.tone}`}>{state.label}</span>
      </button>

      <p className="person__meta">
        {until ? `${state.allowed ? 'Until' : 'Ended'} ${until}` : 'Never granted'}
        {person.lastGrant
          ? ` · last cycle ${person.lastGrant.amount} ${person.lastGrant.unit}${
              person.lastGrant.amount === 1 ? '' : 's'
            } by ${person.lastGrant.source}`
          : ''}
      </p>

      {open ? (
        <div className="person__panel">
          <PeriodPicker
            idPrefix={`p-${person.id}`}
            amount={amount}
            unit={unit}
            onAmount={setAmount}
            onUnit={setUnit}
            label={state.allowed ? 'Extend by' : 'Reactivate for'}
          />

          <button
            className="btn btn--primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                setNote(null);
                const result = await extendPerson(person.id, amount, unit);
                if (!result.ok) return setError(result.error);
                setNote('Access granted. No code needed.');
              })
            }
          >
            {pending ? 'Working…' : state.allowed ? 'Extend' : 'Reactivate now'}
          </button>

          <button
            className="btn"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await setPersonStatus(person.id, person.status !== 'stopped');
              })
            }
          >
            {person.status === 'stopped' ? 'Resume access' : 'Stop access'}
          </button>

          {showMove ? (
            <>
              <div className="field">
                <label className="field__label" htmlFor={`move-${person.id}`}>
                  Move this account to
                </label>
                <input
                  id={`move-${person.id}`}
                  type="email"
                  className="field__input"
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                  placeholder="new@example.com"
                />
              </div>
              <p className="src__controlNote">
                Everything follows: charts, tasks, money, devices. They sign in at the new address
                with the same passphrase. To start them fresh instead, leave this alone and send a
                new invite, which creates a separate account.
              </p>
              <button
                className="btn btn--primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    setNote(null);
                    const result = await movePerson(person.id, moveTo);
                    if (!result.ok) return setError(result.error);
                    setMoveTo('');
                    setShowMove(false);
                    setNote('Moved. All their data came with it.');
                  })
                }
              >
                Move account
              </button>
            </>
          ) : (
            <button className="btn btn--quiet" onClick={() => setShowMove(true)}>
              Change their email
            </button>
          )}

          {error ? (
            <p className="auth__error" role="alert">
              {error}
            </p>
          ) : null}
          {note ? <p className="src__controlNote">{note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
