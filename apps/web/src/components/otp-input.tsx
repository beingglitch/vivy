'use client';

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

/**
 * Six-digit code entry.
 *
 * One box per digit, which is worth the extra code for two reasons: it tells you
 * how many digits to expect before you start typing, and a wrong digit is
 * visible in place rather than buried in a string.
 *
 * The behaviours people expect and notice when missing:
 *
 * - **Paste fills everything.** Codes arrive to be copied, and a paste landing
 *   entirely in box one is the most common way these components fail.
 * - **Backspace on an empty box steps back** and clears the previous one, so
 *   correcting a typo is one key, not two.
 * - **Completing the code submits.** Six digits have exactly one meaning; making
 *   someone reach for a button afterwards is a pointless extra step.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const completed = useRef(false);

  useEffect(() => {
    if (value.length === 6 && !completed.current) {
      completed.current = true;
      onComplete?.(value);
    }
    if (value.length < 6) completed.current = false;
  }, [value, onComplete]);

  function focusBox(index: number) {
    boxes.current[Math.max(0, Math.min(5, index))]?.focus();
  }

  function setDigit(index: number, digit: string) {
    const next = value.padEnd(6, ' ').split('');
    next[index] = digit;
    onChange(next.join('').replace(/\s+$/, '').trimEnd());
  }

  function handleInput(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    setDigit(index, digit);
    if (index < 5) focusBox(index + 1);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (digits[index]?.trim()) {
        setDigit(index, ' ');
      } else if (index > 0) {
        setDigit(index - 1, ' ');
        focusBox(index - 1);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(index + 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    focusBox(Math.min(pasted.length, 5));
  }

  return (
    <div className="otp" role="group" aria-label="Six-digit code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            boxes.current[index] = el;
          }}
          className="otp__box"
          type="text"
          inputMode="numeric"
          // Only the first box advertises one-time-code, or some password
          // managers try to fill all six with the same value.
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit.trim()}
          disabled={disabled ?? false}
          autoFocus={(autoFocus ?? false) && index === 0}
          aria-label={`Digit ${index + 1}`}
          onChange={(e) => handleInput(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
