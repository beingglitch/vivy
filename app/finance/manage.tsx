'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { POSITION_CATEGORIES, fmtINR } from '@/lib/finance';

const inputCls =
  'rounded-lg border border-seam bg-night px-3 py-1.5 text-sm text-linen placeholder:text-moth/50 outline-none transition-colors focus:border-ember/60';
const primaryBtn =
  'rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-night transition hover:brightness-110 disabled:opacity-50';

export type Position = {
  id: string;
  kind: 'asset' | 'liability';
  name: string;
  category: string;
  value: string;
  consider: boolean;
  nextOutflow: string | null;
  note: string | null;
};

export type Recurring = {
  id: string;
  name: string;
  amount: string;
  type: 'expense' | 'income';
  category: string;
  dayOfMonth: number | null;
  active: boolean;
};

async function call(path: string, method: string, body?: Record<string, unknown>) {
  await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// One asset/liability line: name · bar · value; ✎ opens inline edit.
export function PositionRow({ item, max }: { item: Position; max: number }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [value, setValue] = useState(item.value);
  const [next, setNext] = useState(item.nextOutflow ?? '');
  const [consider, setConsider] = useState(item.consider);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const v = Number(item.value);
  const barColor = item.kind === 'asset' ? 'bg-sage' : 'bg-rose';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await call(`/api/positions/${item.id}`, 'PATCH', {
      name: name.trim() || item.name,
      value: Number(value),
      nextOutflow: Number(next) > 0 ? Number(next) : null,
      consider,
    });
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <li className={`space-y-1.5 px-4 py-2.5 ${item.consider ? '' : 'opacity-60'}`}>
      {/* On phones the bar wraps to its own full-width line so the row never
          overflows the viewport; from sm up it sits inline as before. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <span className="min-w-0 flex-1 truncate text-moth sm:w-32 sm:flex-none" title={item.note ?? item.name}>
          {item.name}
        </span>
        {!item.consider && (
          <span className="shrink-0 rounded-full bg-seam/80 px-2 py-0.5 text-[10px] text-moth/80">
            not counted
          </span>
        )}
        {item.nextOutflow && Number(item.nextOutflow) > 0 && (
          <span
            className="shrink-0 rounded-full bg-ember/15 px-2 py-0.5 font-mono text-[10px] whitespace-nowrap text-ember"
            title="Planned payment next month"
          >
            {fmtINR(Number(item.nextOutflow))} next mo
          </span>
        )}
        <div className="order-last h-2 basis-full overflow-hidden rounded-full bg-seam/60 sm:order-none sm:flex-1 sm:basis-auto">
          <div
            className={`h-full rounded-r-full ${barColor}`}
            style={{ width: `${Math.max((v / max) * 100, 2)}%` }}
          />
        </div>
        <span className="shrink-0 text-right font-mono text-xs whitespace-nowrap text-linen/90 sm:w-24">
          {fmtINR(v)}
        </span>
        <button
          onClick={() => setEditing((x) => !x)}
          title="Edit"
          className="text-xs text-hush transition-colors hover:text-linen"
        >
          ✎
        </button>
      </div>
      {editing && (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className={`w-36 ${inputCls}`} />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            className={`w-28 font-mono ${inputCls}`}
          />
          {item.kind === 'liability' && (
            <input
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="₹ next mo"
              inputMode="decimal"
              title="Planned payment next month"
              className={`w-24 font-mono ${inputCls}`}
            />
          )}
          <label className="flex items-center gap-1.5 text-xs text-moth">
            <input type="checkbox" checked={consider} onChange={(e) => setConsider(e.target.checked)} />
            counted
          </label>
          <button disabled={busy} className={primaryBtn}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-moth hover:text-linen">
            cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await call(`/api/positions/${item.id}`, 'DELETE');
              router.refresh();
            }}
            className="ml-auto text-xs text-moth transition-colors hover:text-rose"
          >
            remove
          </button>
        </form>
      )}
    </li>
  );
}

export function AddPosition({ kind }: { kind: 'asset' | 'liability' }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState<string>(POSITION_CATEGORIES[kind][0]);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !(Number(value) >= 0)) return;
    setBusy(true);
    await call('/api/positions', 'POST', { kind, name: name.trim(), value: Number(value), category });
    setName('');
    setValue('');
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-moth transition-colors hover:text-ember">
        + add {kind === 'asset' ? 'an asset' : 'a liability'}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={kind === 'asset' ? 'Savings account…' : 'Loan…'}
        autoFocus
        className={`w-40 ${inputCls}`}
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="₹ value"
        inputMode="decimal"
        className={`w-28 font-mono ${inputCls}`}
      />
      <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
        {POSITION_CATEGORIES[kind].map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button disabled={busy} className={primaryBtn}>
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-moth hover:text-linen">
        cancel
      </button>
    </form>
  );
}

// Recurring rule row: name · ₹/mo · day; toggle pauses it, ✎ edits.
export function RecurringRow({ item }: { item: Recurring }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.amount);
  const [day, setDay] = useState(item.dayOfMonth?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await call(`/api/recurring/${item.id}`, 'PATCH', {
      name: name.trim() || item.name,
      amount: Number(amount),
      dayOfMonth: Number(day) >= 1 && Number(day) <= 31 ? Number(day) : null,
    });
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <li className={`space-y-1.5 px-4 py-2.5 ${item.active ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-3 text-sm">
        <span className={`font-mono text-xs ${item.type === 'income' ? 'text-sage' : 'text-ember'}`}>
          {item.type === 'income' ? '↑' : '↓'}
        </span>
        <span className="flex-1 truncate text-linen/90">{item.name}</span>
        <span className="rounded-full bg-seam/80 px-2 py-0.5 text-[10px] text-moth">{item.category}</span>
        {item.dayOfMonth && (
          <span className="shrink-0 font-mono text-[10px] text-moth/70">day {item.dayOfMonth}</span>
        )}
        <span className="w-24 shrink-0 text-right font-mono text-xs text-linen/90">
          {fmtINR(Number(item.amount))}/mo
        </span>
        <button
          onClick={async () => {
            await call(`/api/recurring/${item.id}`, 'PATCH', { active: !item.active });
            router.refresh();
          }}
          title={item.active ? 'Pause' : 'Resume'}
          className="text-xs text-hush transition-colors hover:text-linen"
        >
          {item.active ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => setEditing((x) => !x)}
          title="Edit"
          className="text-xs text-hush transition-colors hover:text-linen"
        >
          ✎
        </button>
      </div>
      {editing && (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className={`w-36 ${inputCls}`} />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className={`w-24 font-mono ${inputCls}`}
          />
          <input
            value={day}
            onChange={(e) => setDay(e.target.value)}
            placeholder="day"
            inputMode="numeric"
            className={`w-16 ${inputCls}`}
          />
          <button disabled={busy} className={primaryBtn}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-moth hover:text-linen">
            cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await call(`/api/recurring/${item.id}`, 'DELETE');
              router.refresh();
            }}
            className="ml-auto text-xs text-moth transition-colors hover:text-rose"
          >
            remove
          </button>
        </form>
      )}
    </li>
  );
}

export function AddRecurring() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [day, setDay] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !(Number(amount) > 0)) return;
    setBusy(true);
    await call('/api/recurring', 'POST', {
      name: name.trim(),
      amount: Number(amount),
      type,
      category: type === 'income' ? 'salary' : 'bills',
      dayOfMonth: Number(day) >= 1 && Number(day) <= 31 ? Number(day) : null,
    });
    setName('');
    setAmount('');
    setDay('');
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-moth transition-colors hover:text-ember">
        + add recurring
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Rent, salary, Spotify…"
        autoFocus
        className={`w-44 ${inputCls}`}
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="₹/month"
        inputMode="decimal"
        className={`w-24 font-mono ${inputCls}`}
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as 'expense' | 'income')}
        className={inputCls}
      >
        <option value="expense">expense</option>
        <option value="income">income</option>
      </select>
      <input
        value={day}
        onChange={(e) => setDay(e.target.value)}
        placeholder="day"
        inputMode="numeric"
        className={`w-16 ${inputCls}`}
      />
      <button disabled={busy} className={primaryBtn}>
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-moth hover:text-linen">
        cancel
      </button>
    </form>
  );
}
