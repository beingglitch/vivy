'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/lib/settings';

const inputCls =
  'w-full rounded-lg border border-seam bg-night px-3 py-2 text-sm text-linen placeholder:text-moth/50 outline-none transition-colors focus:border-ember/60';

export function ProfileForm({ initial }: { initial: Profile }) {
  const [name, setName] = useState(initial.name);
  const [dob, setDob] = useState(initial.dob);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, dob }),
    });
    setBusy(false);
    if (res.ok) {
      setFlash('Saved.');
      setTimeout(() => setFlash(''), 2000);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({ error: 'save failed' }));
      setFlash(j.error ?? 'save failed');
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-seam bg-veil/50 p-5">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium tracking-widest text-moth uppercase">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputCls} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium tracking-widest text-moth uppercase">Date of birth</span>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
        <span className="block text-[11px] text-moth/70">Shown as your age next to net worth.</span>
      </label>
      <div className="flex items-center gap-3">
        <button
          disabled={busy}
          className="rounded-lg bg-ember px-4 py-2 text-sm font-medium text-night transition hover:brightness-110 disabled:opacity-50"
        >
          Save
        </button>
        <span className="text-xs text-moth" aria-live="polite">
          {flash}
        </span>
      </div>
    </form>
  );
}
