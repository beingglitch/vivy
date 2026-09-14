'use client';

import { useState, useTransition } from 'react';
import { saveDisplayName } from './actions';

export function UserForm({ current }: { current: string }) {
  const [displayName, setDisplayName] = useState(current);
  const [savedName, setSavedName] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const result = await saveDisplayName(displayName);
      if (!result.ok) return setError(result.error);
      setSavedName(displayName.trim());
      setError(null);
    });
  }

  return (
    <div className="user-form">
      <label className="money-field">
        <span>Name</span>
        <input
          value={displayName}
          maxLength={60}
          autoComplete="name"
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>
      {error ? <p className="pair__error">{error}</p> : null}
      <button
        type="button"
        className="btn btn--primary"
        disabled={pending || !displayName.trim() || displayName.trim() === savedName}
        onClick={save}
      >
        {pending ? 'Saving…' : 'Save name'}
      </button>
    </div>
  );
}
