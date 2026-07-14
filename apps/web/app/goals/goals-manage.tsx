'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Goal = {
  id: string;
  title: string;
  kind: string;
  metric: string | null;
  target: string | null;
  deadline: string | null;
  status: string;
  note: string | null;
};
type Progress = {
  goal: Goal;
  current: number | null;
  fraction: number | null;
  timeFraction: number | null;
  onPace: boolean | null;
  line: string;
};

const KINDS = ['money', 'reading', 'health', 'custom'] as const;
const KIND_METRICS: Record<string, { key: string; label: string }[]> = {
  money: [{ key: 'networth', label: 'liquid net worth (₹)' }],
  reading: [
    { key: 'books_finished', label: 'books finished' },
    { key: 'learning_units_week', label: 'learning units per week' },
  ],
  health: [], // metrics arrive with meal/sleep events (SPEC-0011)
  custom: [
    { key: '', label: 'no auto metric' },
    { key: 'networth', label: 'liquid net worth (₹)' },
    { key: 'books_finished', label: 'books finished' },
  ],
};

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) alert((await res.json().catch(() => null))?.error ?? `${method} ${url} failed`);
  return res.ok;
}

function PaceBar({ p }: { p: Progress }) {
  if (p.fraction === null) return null;
  return (
    <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-hush/40">
      <div
        className={`h-full rounded-full ${p.onPace === false ? 'bg-rose' : 'bg-sage'}`}
        style={{ width: `${Math.round(p.fraction * 100)}%` }}
      />
      {p.timeFraction !== null && (
        <div
          title="where you should be by now"
          className="absolute top-0 h-full w-0.5 bg-linen/70"
          style={{ left: `${Math.round(p.timeFraction * 100)}%` }}
        />
      )}
    </div>
  );
}

export function GoalsManage({ progress, inactive }: { progress: Progress[]; inactive: Goal[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<string>('money');
  const [metric, setMetric] = useState<string>('networth');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    const ok = await api('/api/goals', 'POST', {
      title,
      kind,
      metric: metric || null,
      target: target || null,
      deadline: deadline || null,
    });
    setBusy(false);
    if (ok) {
      setTitle('');
      setTarget('');
      setDeadline('');
      router.refresh();
    }
  }

  async function setStatus(id: string, status: string) {
    if (await api(`/api/goals/${id}`, 'PATCH', { status })) router.refresh();
  }

  const metricsForKind = KIND_METRICS[kind] ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        {progress.length === 0 && (
          <p className="rounded-xl border border-seam bg-veil p-5 text-sm text-moth">
            No goals yet. &ldquo;Liquid ₹10L in 2 years&rdquo; is one form field away.
          </p>
        )}
        {progress.map((p) => (
          <div key={p.goal.id} className="rounded-xl border border-seam bg-veil p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] text-linen">{p.goal.title}</p>
                <p className="mt-0.5 text-xs text-moth">
                  {p.line.replace(`${p.goal.title}: `, '').replace(p.goal.title, '') || p.goal.kind}
                </p>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                {p.onPace !== null && (
                  <span className={p.onPace ? 'text-sage' : 'text-rose'}>
                    {p.onPace ? 'on pace' : 'behind'}
                  </span>
                )}
                <button onClick={() => setStatus(p.goal.id, 'done')} className="text-moth hover:text-sage">
                  ✓ done
                </button>
                <button onClick={() => setStatus(p.goal.id, 'dropped')} className="text-moth hover:text-rose">
                  drop
                </button>
              </div>
            </div>
            <PaceBar p={p} />
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-seam bg-veil p-4">
        <p className="text-xs font-medium tracking-widest text-moth uppercase">New goal</p>
        <div className="mt-3 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Liquid ₹10,00,000"
            className="w-full rounded-lg border border-seam bg-night px-3 py-2 text-sm text-linen placeholder:text-hush focus:border-ember focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                onClick={() => {
                  setKind(k);
                  setMetric(KIND_METRICS[k]?.[0]?.key ?? '');
                }}
                className={`rounded-full border px-3 py-1 text-xs ${
                  kind === k ? 'border-ember text-ember' : 'border-seam text-moth'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          {kind === 'health' && (
            <p className="text-xs text-moth">
              Health metrics unlock when meal/sleep tracking lands — the goal is saved meanwhile.
            </p>
          )}
          {metricsForKind.length > 0 && (
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="w-full rounded-lg border border-seam bg-night px-3 py-2 text-sm text-linen focus:border-ember focus:outline-none"
            >
              {metricsForKind.map((m) => (
                <option key={m.key} value={m.key}>
                  measured by: {m.label}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-3">
            {metric && (
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                inputMode="numeric"
                placeholder="target (e.g. 1000000)"
                className="w-1/2 rounded-lg border border-seam bg-night px-3 py-2 font-mono text-sm text-linen placeholder:text-hush focus:border-ember focus:outline-none"
              />
            )}
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-1/2 rounded-lg border border-seam bg-night px-3 py-2 text-sm text-linen focus:border-ember focus:outline-none"
            />
          </div>
          <button
            onClick={add}
            disabled={busy || !title.trim()}
            className="rounded-lg bg-ember px-4 py-2 text-sm font-medium text-night disabled:opacity-50"
          >
            Set goal
          </button>
        </div>
      </section>

      {inactive.length > 0 && (
        <details className="rounded-xl border border-seam bg-veil">
          <summary className="cursor-pointer px-4 py-3 text-xs font-medium tracking-widest text-moth uppercase">
            Done & dropped ({inactive.length})
          </summary>
          <ul className="space-y-2 px-4 pb-4">
            {inactive.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 text-sm">
                <span className={g.status === 'done' ? 'text-linen/80' : 'text-moth line-through'}>
                  {g.title}
                </span>
                <span className="flex gap-2 text-xs">
                  <button onClick={() => setStatus(g.id, 'active')} className="text-moth hover:text-linen">
                    reopen
                  </button>
                  <button
                    onClick={async () => {
                      if (await api(`/api/goals/${g.id}`, 'DELETE')) router.refresh();
                    }}
                    className="text-moth hover:text-rose"
                  >
                    remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
