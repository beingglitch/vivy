'use client';

import { useState } from 'react';

/**
 * A passphrase input with a reveal toggle.
 *
 * Worth having wherever a passphrase is typed, and especially at signup: this
 * one cannot be reset without losing sealed data, so being able to check what
 * you typed before committing to it matters more than usual.
 *
 * Starts hidden, and the button says what it will do rather than what the state
 * is, "Show" reveals, "Hide" conceals. Labelling it with the current state is
 * the classic way to make a toggle ambiguous.
 */
export function PassphraseField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  autoFocus,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  autoComplete?: 'current-password' | 'new-password';
  autoFocus?: boolean;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <div className="field__row">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        {hint ? <span className="field__hint">{hint}</span> : null}
      </div>

      <div className="field__wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="field__input field__input--padded"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder ?? ''}
          required
          autoFocus={autoFocus ?? false}
          // A revealed passphrase should not be autocorrected or capitalised.
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="field__eye"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide passphrase' : 'Show passphrase'}
          aria-pressed={visible}
          // Never a submit target, and skipped when tabbing from the field to
          // the primary button.
          tabIndex={-1}
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </div>
  );
}

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const Eye = () => (
  <svg {...base}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOff = () => (
  <svg {...base}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M4 4l16 16" />
  </svg>
);
