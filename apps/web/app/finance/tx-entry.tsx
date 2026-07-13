'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TX_CATEGORIES, INCOME_CATEGORIES } from '@/lib/finance';
import { VoiceButton } from '@/app/voice-button';

export type Bill = {
  id: string;
  name: string;
  amount: number;
  category: string;
  paid: boolean;
};

// Speed is the whole design: type the amount, tap a category — saved.
// The note is optional and never blocks the save.
export function TxEntry({ bills = [] }: { bills?: Bill[] }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'expense' | 'income'>('expense');
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
      body: JSON.stringify({
        amount: n,
        category,
        type: mode,
        note: note.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setFlash(`${mode === 'income' ? '+' : ''}₹${n} · ${category} — saved`);
      setAmount('');
      setNote('');
      amountRef.current?.focus();
      setTimeout(() => setFlash(''), 2500);
      router.refresh();
    }
  }

  // One tap settles a bill. A typed amount overrides the usual one (bills like
  // electricity vary month to month).
  async function payBill(bill: Bill) {
    const typed = Number(amount);
    const n = Number.isFinite(typed) && typed > 0 ? typed : bill.amount;
    setBusy(true);
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: n,
        category: bill.category,
        type: 'expense',
        note: bill.name,
        recurringId: bill.id,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setFlash(`₹${n} · ${bill.name} — bill settled`);
      setAmount('');
      setNote('');
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
        <VoiceButton onText={(t) => setNote((prev) => (prev ? `${prev} ${t}` : t))} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="mr-1 flex overflow-hidden rounded-full border border-seam text-[11px]">
          {(['expense', 'income'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? `px-2.5 py-1 font-medium ${m === 'income' ? 'bg-sage' : 'bg-ember'} text-night`
                  : 'px-2.5 py-1 text-moth hover:text-linen'
              }
            >
              {m === 'expense' ? 'spent' : 'got'}
            </button>
          ))}
        </div>
        {(mode === 'expense' ? TX_CATEGORIES : INCOME_CATEGORIES).map((c) => (
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
      {mode === 'expense' && bills.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-seam/60 pt-3">
          <span className="mr-1 text-[11px] text-moth">bills</span>
          {bills.map((b) =>
            b.paid ? (
              <span
                key={b.id}
                className="rounded-full border border-sage/40 px-3 py-1.5 text-xs text-sage/80"
              >
                ✓ {b.name}
              </span>
            ) : (
              <button
                key={b.id}
                onClick={() => payBill(b)}
                disabled={busy}
                title={`Settle ${b.name} — uses the typed amount if you entered one`}
                className="rounded-full border border-seam bg-night px-3 py-1.5 text-xs text-moth transition-colors hover:border-ember/60 hover:text-linen active:bg-ember active:text-night disabled:opacity-50"
              >
                {b.name} <span className="font-mono text-moth/70">₹{b.amount.toLocaleString('en-IN')}</span>
              </button>
            ),
          )}
        </div>
      )}
      <p className="text-xs text-moth/70" aria-live="polite">
        {flash || 'Type the amount, tap a category — done. Tap a bill to settle it for the month.'}
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
