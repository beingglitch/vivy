'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TX_CATEGORIES } from '@/lib/finance';

// Speed is the whole design: type the amount, tap a category — saved.
// The note is optional and never blocks the save.
export function TxEntry() {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function save(category: string) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      amountRef.current?.focus();
      return;
    }
    setBusy(true);
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: n, category, note: note.trim() || null }),
    });
    setBusy(false);
    if (res.ok) {
      setFlash(`₹${n} · ${category} — saved`);
      setAmount('');
      setNote('');
      amountRef.current?.focus();
      setTimeout(() => setFlash(''), 2500);
      router.refresh();
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-seam bg-veil p-4">
      <div className="flex gap-2">
        <div className="relative w-36">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-lg text-moth">
            ₹
          </span>
          <input
            ref={amountRef}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            autoFocus
            className="w-full rounded-lg border border-seam bg-night py-2.5 pr-3 pl-8 font-mono text-lg text-linen placeholder:text-moth/40 outline-none transition-colors focus:border-ember/60"
          />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="note (optional)"
          className="min-w-0 flex-1 rounded-lg border border-seam bg-night px-3 py-2.5 text-sm text-linen placeholder:text-moth/40 outline-none transition-colors focus:border-ember/60"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TX_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => save(c)}
            disabled={busy}
            className="rounded-full border border-seam bg-night px-3 py-1.5 text-xs text-moth transition-colors hover:border-ember/60 hover:text-linen active:bg-ember active:text-night disabled:opacity-50"
          >
            {c}
          </button>
        ))}
      </div>
      <p className="text-xs text-moth/70" aria-live="polite">
        {flash || 'Type the amount, tap a category — done.'}
      </p>
    </section>
  );
}

export function TxDelete({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        router.refresh();
      }}
      title="Delete entry"
      className="shrink-0 text-hush transition-colors hover:text-rose"
    >
      ✕
    </button>
  );
}
