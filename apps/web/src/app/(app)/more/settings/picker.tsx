'use client';

import { useOptimistic, useTransition } from 'react';
import type { LoginMethod } from '@/lib/session';
import { chooseLoginMethod } from './actions';

/**
 * Optimistic because the choice is cosmetic and instant feedback matters more
 * than confirming a write that cannot meaningfully fail. If it does fail, the
 * next render corrects it.
 */
export function LoginMethodPicker({ current }: { current: LoginMethod }) {
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(current);

  const options: readonly { id: LoginMethod; label: string }[] = [
    { id: 'passphrase', label: 'Passphrase' },
    { id: 'email', label: 'Email code' },
  ];

  return (
    <div className="chips" role="radiogroup" aria-label="Default sign-in method">
      {options.map((option) => (
        <button
          key={option.id}
          role="radio"
          className="chip"
          aria-checked={shown === option.id}
          aria-selected={shown === option.id}
          disabled={pending}
          onClick={() =>
            start(async () => {
              setShown(option.id);
              await chooseLoginMethod(option.id);
            })
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
