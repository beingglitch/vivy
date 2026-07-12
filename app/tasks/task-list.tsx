'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Task = {
  id: string;
  title: string;
  status: string;
  priority: number;
  due: string | null;
  aiProposed: boolean;
};

const inputCls =
  'rounded-lg border border-seam bg-veil px-3 py-2 text-sm text-linen placeholder:text-moth/60 outline-none transition-colors focus:border-ember/60';
const primaryBtn =
  'rounded-lg bg-ember px-4 py-2 text-sm font-medium text-night transition hover:brightness-110 disabled:opacity-50';

export function TaskList({ initial }: { initial: Task[] }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const router = useRouter();

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) throw new Error(`add task ${res.status}`);
      // Only clear once it's really saved — a failed save keeps your words.
      setTitle('');
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  const setStatus = (id: string, status: string) => patch(id, { status });

  const proposed = initial.filter((t) => t.aiProposed && t.status !== 'done');
  const open = initial.filter((t) => !t.aiProposed && t.status !== 'done');
  const done = initial.filter((t) => t.status === 'done');

  return (
    <div className="space-y-8">
      <div>
        <form onSubmit={addTask} className="flex gap-2">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (failed) setFailed(false);
            }}
            placeholder="Add a task…"
            aria-invalid={failed}
            className={`flex-1 ${inputCls}`}
          />
          <button disabled={busy} className={primaryBtn}>
            Add
          </button>
        </form>
        {failed && (
          <p role="alert" className="mt-2 text-xs text-rose">
            Couldn&apos;t save that — check your connection and press Add again.
          </p>
        )}
      </div>

      {proposed.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-medium tracking-widest text-ember uppercase">
            I found these — approve or reject
          </h2>
          <ul className="divide-y divide-seam/60 rounded-xl border border-ember/30 bg-veil/50">
            {proposed.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 text-linen/90">{t.title}</span>
                {t.due && <span className="font-mono text-xs text-moth">{t.due}</span>}
                <button
                  onClick={() => patch(t.id, { aiProposed: false })}
                  className="rounded-lg bg-ember px-2.5 py-1 text-xs font-medium text-night transition hover:brightness-110"
                >
                  Approve
                </button>
                <button
                  onClick={() => patch(t.id, { status: 'dropped' })}
                  className="text-moth transition-colors hover:text-rose"
                  title="Reject"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open.length === 0 ? (
        <p className="text-sm text-moth">Nothing on your plate. Add one above, or tell me in chat.</p>
      ) : (
        <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
          {open.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <button
                onClick={() => setStatus(t.id, 'done')}
                title="Mark done"
                className="h-4 w-4 shrink-0 rounded-full border border-hush transition-colors hover:border-sage hover:bg-sage/30"
              />
              <span className="flex-1 text-linen/90">{t.title}</span>
              {t.due && <span className="font-mono text-xs text-moth">{t.due}</span>}
              <button
                onClick={() => setStatus(t.id, 'dropped')}
                title="Drop"
                className="text-hush transition-colors hover:text-rose"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-moth">Done ({done.length})</summary>
          <ul className="mt-3 divide-y divide-seam/60 rounded-xl border border-seam bg-veil/30">
            {done.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm text-moth">
                <span className="text-sage" aria-hidden>
                  ✓
                </span>
                <span className="flex-1 line-through decoration-hush">{t.title}</span>
                <button
                  onClick={() => setStatus(t.id, 'inbox')}
                  className="text-xs text-moth transition-colors hover:text-linen"
                >
                  reopen
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
