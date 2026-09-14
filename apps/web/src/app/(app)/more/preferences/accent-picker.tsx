'use client';

import { useState, useTransition } from 'react';
import { ACCENT_COLOURS } from '@/lib/profile-shared';
import { saveAccentColour } from './actions';

export function AccentPicker({ current }: { current: string }) {
  const [selected, setSelected] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(value: string) {
    const previous = selected;
    setSelected(value);
    setError(null);
    applyPreview(value);
    start(async () => {
      const result = await saveAccentColour(value);
      if (result.ok) return;
      setSelected(previous);
      applyPreview(previous);
      setError(result.error);
    });
  }

  return (
    <div className="accent-picker" aria-busy={pending}>
      {ACCENT_COLOURS.map((option) => (
        <button
          type="button"
          key={option.value}
          className={selected === option.value ? 'accent-picker__option--on' : ''}
          aria-label={`${option.label} accent`}
          aria-pressed={selected === option.value}
          onClick={() => choose(option.value)}
        >
          <span style={{ background: option.value }} />
          <small>{option.label}</small>
        </button>
      ))}
      {error ? <p className="pair__error">{error}</p> : null}
    </div>
  );
}

function applyPreview(value: string) {
  const phone = document.querySelector<HTMLElement>('.phone');
  if (!phone) return;
  phone.style.setProperty('--accent', value);
  phone.style.setProperty('--accent-soft', `color-mix(in srgb, ${value} 12%, white)`);
  phone.style.setProperty('--accent-wash', `color-mix(in srgb, ${value} 5%, white)`);
}
