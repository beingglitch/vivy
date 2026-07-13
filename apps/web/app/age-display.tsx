'use client';

import { useEffect, useState } from 'react';

// Two ways to feel the same clock: "258 days to 24" — the countdown to the
// next birthday — and "23y 3m" — how far it has already run. Tap to switch;
// the choice sticks across pages.
function breakdown(dob: string) {
  const d = new Date(dob + 'T00:00:00');
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  let next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next.getTime() <= now.getTime()) next = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
  const days = Math.ceil((next.getTime() - now.getTime()) / 86400000);
  return { years, months, days, turning: years + 1 };
}

export function AgeDisplay({ dob, numberClass }: { dob: string; numberClass: string }) {
  const [mode, setMode] = useState<'countdown' | 'ym'>('countdown');
  useEffect(() => {
    if (localStorage.getItem('vivy-age-fmt') === 'ym') setMode('ym');
  }, []);
  const a = breakdown(dob);
  return (
    <button
      type="button"
      onClick={(e) => {
        // The home hero is a Link — don't let the tap navigate.
        e.preventDefault();
        e.stopPropagation();
        const next = mode === 'countdown' ? 'ym' : 'countdown';
        setMode(next);
        localStorage.setItem('vivy-age-fmt', next);
      }}
      title="Tap to switch how age is shown"
      className="cursor-pointer text-center"
    >
      <p className="text-xs font-medium tracking-widest text-moth uppercase">
        {mode === 'countdown' ? `days to ${a.turning}` : 'age'}
      </p>
      <p className={numberClass}>{mode === 'countdown' ? a.days : `${a.years}y ${a.months}m`}</p>
    </button>
  );
}
