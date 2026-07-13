'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type SuggestedPaper = {
  id: string;
  title: string;
  authors: string | null;
  url: string;
  why: string | null;
  topicName: string | null;
};

export type Topic = {
  id: string;
  name: string;
  weight: string;
  active: boolean;
};

const inputCls =
  'rounded-lg border border-seam bg-night px-3 py-1.5 text-sm text-linen placeholder:text-moth/50 outline-none transition-colors focus:border-ember/60';

async function call(path: string, method: string, body?: Record<string, unknown>) {
  await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Daily paper suggestions + the topic weights that steer them. Reading bumps a
// topic, skipping decays it — over months the weights say who you actually are.
export function PapersPanel({ suggestions, topics }: { suggestions: SuggestedPaper[]; topics: Topic[] }) {
  const [busy, setBusy] = useState<string>('');
  const [fetching, setFetching] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const router = useRouter();

  async function act(id: string, action: 'read' | 'skip') {
    setBusy(id);
    await call(`/api/papers/${id}`, 'PATCH', { action });
    setBusy('');
    router.refresh();
  }

  async function findNow() {
    setFetching(true);
    await fetch('/api/papers', { method: 'POST' }).catch(() => {});
    setFetching(false);
    router.refresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium tracking-widest text-moth uppercase">
          Papers · suggested for you
        </h2>
        <button
          onClick={findNow}
          disabled={fetching}
          className="text-xs text-moth transition-colors hover:text-ember disabled:opacity-50"
        >
          {fetching ? 'searching arXiv…' : '↻ find papers now'}
        </button>
      </div>

      {suggestions.length === 0 ? (
        <p className="rounded-xl border border-seam bg-veil/30 px-4 py-3 text-xs text-moth/70">
          No suggestions waiting. New ones land every morning — or tap “find papers now”.
        </p>
      ) : (
        <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
          {suggestions.map((p) => (
            <li key={p.id} className="space-y-1.5 px-4 py-3">
              <div className="flex items-start gap-2">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 text-sm leading-snug text-linen/95 transition-colors hover:text-ember"
                >
                  {p.title} <span className="text-moth/70">↗</span>
                </a>
              </div>
              <p className="text-xs text-moth">
                {p.topicName && (
                  <span className="mr-2 rounded-full bg-seam/80 px-2 py-0.5 text-[10px]">{p.topicName}</span>
                )}
                {p.authors}
              </p>
              {p.why && <p className="font-voice text-[13px] text-linen/80 italic">{p.why}</p>}
              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={() => act(p.id, 'read')}
                  disabled={busy === p.id}
                  className="rounded-lg bg-ember px-3 py-1 text-xs font-medium text-night transition hover:brightness-110 disabled:opacity-50"
                >
                  start reading
                </button>
                <button
                  onClick={() => act(p.id, 'skip')}
                  disabled={busy === p.id}
                  className="rounded-lg border border-seam px-3 py-1 text-xs text-moth transition-colors hover:text-linen disabled:opacity-50"
                >
                  skip
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-moth transition-colors hover:text-linen">
          Topics ({topics.filter((t) => t.active).length} active) — weights steer the suggestions
        </summary>
        <div className="mt-3 space-y-2">
          <ul className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <li
                key={t.id}
                className={`flex items-center gap-1.5 rounded-full border border-seam px-2.5 py-1 text-xs ${
                  t.active ? 'text-linen/90' : 'text-moth/50 line-through'
                }`}
              >
                {t.name}
                <span className="font-mono text-[10px] text-moth/70">{Number(t.weight).toFixed(1)}</span>
                <button
                  onClick={async () => {
                    await call(`/api/topics/${t.id}`, 'PATCH', { active: !t.active });
                    router.refresh();
                  }}
                  title={t.active ? 'Pause' : 'Resume'}
                  className="text-hush hover:text-linen"
                >
                  {t.active ? '⏸' : '▶'}
                </button>
                <button
                  onClick={async () => {
                    await call(`/api/topics/${t.id}`, 'DELETE');
                    router.refresh();
                  }}
                  title="Remove"
                  className="text-hush hover:text-rose"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newTopic.trim()) return;
              await call('/api/topics', 'POST', { name: newTopic.trim() });
              setNewTopic('');
              router.refresh();
            }}
            className="flex gap-2"
          >
            <input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="add a topic (e.g. computer vision)"
              className={`w-64 ${inputCls}`}
            />
            <button className="rounded-lg bg-ember px-3 py-1.5 text-xs font-medium text-night hover:brightness-110">
              Add
            </button>
          </form>
        </div>
      </details>
    </section>
  );
}
