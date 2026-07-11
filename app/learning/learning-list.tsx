'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Item = {
  id: string;
  kind: 'book' | 'course';
  title: string;
  author: string | null;
  status: string;
  unitName: string;
  unitsTotal: number | null;
  unitsDone: number;
  startedAt: string | null;
};

// Progress is always "+N units"; the unit just names what N is for this item.
const UNIT_NAMES = ['chapter', 'page', 'section', 'lesson', 'module', 'hour', 'video', 'episode'] as const;

const inputCls =
  'rounded-lg border border-seam bg-night px-3 py-1.5 text-sm text-linen placeholder:text-moth/50 outline-none transition-colors focus:border-ember/60';
const primaryBtn =
  'rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-night transition hover:brightness-110 disabled:opacity-50';

async function patchItem(id: string, body: Record<string, unknown>) {
  await fetch(`/api/learning/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function EditForm({ item, onClose }: { item: Item; onClose: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [author, setAuthor] = useState(item.author ?? '');
  const [total, setTotal] = useState(item.unitsTotal?.toString() ?? '');
  const [unit, setUnit] = useState(item.unitName);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await patchItem(item.id, {
      title: title.trim() || item.title,
      author: author.trim() || null,
      unitsTotal: Number(total) > 0 ? Number(total) : null,
      unitName: unit,
    });
    setBusy(false);
    onClose();
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    await patchItem(item.id, { status: 'dropped' });
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2 pt-1">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={`min-w-40 flex-1 ${inputCls}`} />
      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder={item.kind === 'book' ? 'author' : 'platform'}
        className={`w-32 ${inputCls}`}
      />
      <input
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        placeholder={`total ${unit}s`}
        inputMode="numeric"
        className={`w-28 ${inputCls}`}
      />
      <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
        {UNIT_NAMES.map((u) => (
          <option key={u} value={u}>
            {u}s
          </option>
        ))}
      </select>
      <button disabled={busy} className={primaryBtn}>
        Save
      </button>
      <button type="button" onClick={onClose} className="text-xs text-moth hover:text-linen">
        cancel
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="ml-auto text-xs text-moth transition-colors hover:text-rose"
      >
        remove
      </button>
    </form>
  );
}

function ProgressRow({ item }: { item: Item }) {
  const [units, setUnits] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const pct = item.unitsTotal
    ? Math.min(100, Math.round((item.unitsDone / item.unitsTotal) * 100))
    : null;

  async function log(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(units);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    await patchItem(item.id, { logUnits: n });
    setUnits('');
    setBusy(false);
    router.refresh();
  }

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="flex-1 text-linen/90">
          {item.title}
          {item.author && <span className="ml-2 text-xs text-moth">{item.author}</span>}
        </span>
        <span className="font-mono text-xs text-moth">
          {item.unitsDone}
          {item.unitsTotal ? `/${item.unitsTotal}` : ''} {item.unitName}s
          {pct !== null && <span className="ml-1 text-ember">{pct}%</span>}
        </span>
        {item.status === 'done' ? (
          <span className="rounded-full bg-sage/15 px-2 py-0.5 text-[10px] text-sage">done</span>
        ) : (
          <form onSubmit={log} className="flex items-center gap-1">
            <input
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="+N"
              inputMode="numeric"
              className="w-12 rounded-lg border border-seam bg-night px-1.5 py-1 text-center text-xs text-linen placeholder:text-moth/50 outline-none transition-colors focus:border-ember/60"
            />
            <button
              disabled={busy}
              className="rounded-lg bg-ember px-2.5 py-1 text-xs font-medium text-night transition hover:brightness-110 disabled:opacity-50"
            >
              log
            </button>
          </form>
        )}
        {item.status !== 'done' && (
          <button
            onClick={async () => {
              await patchItem(item.id, { status: 'done' });
              router.refresh();
            }}
            title="Mark finished"
            className="text-xs text-hush transition-colors hover:text-sage"
          >
            ✓
          </button>
        )}
        <button
          onClick={() => setEditing((v) => !v)}
          title="Edit"
          className="text-xs text-hush transition-colors hover:text-linen"
        >
          ✎
        </button>
      </div>
      {pct !== null && item.status !== 'done' && (
        <div className="h-1.5 overflow-hidden rounded-full bg-seam/60">
          <div className="h-full rounded-r-full bg-ember" style={{ width: `${Math.max(pct, 1)}%` }} />
        </div>
      )}
      {editing && <EditForm item={item} onClose={() => setEditing(false)} />}
    </li>
  );
}

function AddForm({ kind }: { kind: 'book' | 'course' }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [total, setTotal] = useState('');
  const [unit, setUnit] = useState(kind === 'book' ? 'chapter' : 'lesson');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await fetch('/api/learning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        title: title.trim(),
        author: author.trim() || null,
        unitsTotal: Number(total) > 0 ? Number(total) : null,
        unitName: unit,
      }),
    });
    setTitle('');
    setAuthor('');
    setTotal('');
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-moth transition-colors hover:text-ember"
      >
        + add a {kind}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={kind === 'book' ? 'Book title…' : 'Course name…'}
        autoFocus
        className={`min-w-40 flex-1 ${inputCls}`}
      />
      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder={kind === 'book' ? 'author' : 'platform'}
        className={`w-32 ${inputCls}`}
      />
      <input
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        placeholder={`#${unit}s`}
        inputMode="numeric"
        className={`w-24 ${inputCls}`}
      />
      <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
        {UNIT_NAMES.map((u) => (
          <option key={u} value={u}>
            {u}s
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

export function LearningList({ initial }: { initial: Item[] }) {
  function section(kind: 'book' | 'course', label: string) {
    const items = initial.filter((i) => i.kind === kind);
    const active = items.filter((i) => i.status === 'active');
    const backlog = items.filter((i) => i.status === 'backlog');
    const done = items.filter((i) => i.status === 'done');
    const ordered = [...active, ...backlog];

    return (
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-medium tracking-widest text-moth uppercase">
            {label}
            <span className="ml-2 font-mono text-[10px] text-hush">
              {active.length} active · {backlog.length} backlog · {done.length} done
            </span>
          </h2>
          <AddForm kind={kind} />
        </div>
        {ordered.length === 0 ? (
          <p className="text-sm text-moth">Nothing here yet.</p>
        ) : (
          <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
            {ordered.map((i) => (
              <ProgressRow key={i.id} item={i} />
            ))}
          </ul>
        )}
        {done.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-moth">Done ({done.length})</summary>
            <ul className="mt-3 divide-y divide-seam/60 rounded-xl border border-seam bg-veil/30">
              {done.map((i) => (
                <li key={i.id} className="flex items-center gap-2 px-4 py-3 text-sm text-moth">
                  <span className="text-sage" aria-hidden>
                    ✓
                  </span>
                  {i.title}
                  {i.author && <span className="text-xs text-hush">{i.author}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-10">
      {section('book', 'Books')}
      {section('course', 'Courses')}
    </div>
  );
}
