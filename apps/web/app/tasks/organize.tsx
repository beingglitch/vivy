'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DAY_NAMES, type Project, type Routine } from './task-list';

const inputCls =
  'rounded-lg border border-seam bg-night px-3 py-1.5 text-sm text-linen placeholder:text-moth/50 outline-none transition-colors focus:border-ember/60';
const primaryBtn =
  'rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-night transition hover:brightness-110 disabled:opacity-50';

async function api(path: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    alert(err?.error ?? 'something went wrong');
  }
}

// The setup drawer: everything here is create/rename/archive plumbing, kept out
// of the daily view. Follows the finance manage.tsx idiom.
export function Organize({
  projects,
  routines,
  areas,
}: {
  projects: Project[];
  routines: Routine[];
  areas: Project[];
}) {
  const current = projects.filter((p) => p.status === 'active');
  const archived = projects.filter((p) => p.status !== 'active');

  return (
    <details className="rounded-xl border border-seam bg-veil/30 px-4 py-3">
      <summary className="cursor-pointer text-sm text-moth transition-colors hover:text-linen">
        organize — areas, projects & routines
      </summary>
      <div className="mt-4 space-y-6">
        <section className="space-y-2">
          <h3 className="text-xs font-medium tracking-widest text-moth uppercase">Areas & projects</h3>
          {current.length > 0 && (
            <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
              {current.map((p) => (
                <ProjectRow key={p.id} p={p} areas={areas} />
              ))}
            </ul>
          )}
          <AddProject areas={areas} />
          {archived.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-moth/70">archived ({archived.length})</summary>
              <ul className="mt-2 divide-y divide-seam/60 rounded-xl border border-seam bg-veil/30">
                {archived.map((p) => (
                  <ArchivedRow key={p.id} p={p} />
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-medium tracking-widest text-moth uppercase">Routines</h3>
          {routines.length > 0 && (
            <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
              {routines.map((r) => (
                <RoutineRow key={r.id} r={r} />
              ))}
            </ul>
          )}
          <AddRoutine />
        </section>
      </div>
    </details>
  );
}

function ProjectRow({ p, areas }: { p: Project; areas: Project[] }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [parentId, setParentId] = useState(p.parentId ?? '');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await api(`/api/projects/${p.id}`, 'PATCH', {
      name: name.trim() || p.name,
      parentId: p.kind === 'project' ? parentId || null : null,
    });
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <li className="space-y-1.5 px-4 py-2.5">
      <div className="flex items-center gap-3 text-sm">
        <span className="w-12 shrink-0 text-[10px] tracking-wider text-moth/70 uppercase">{p.kind}</span>
        <span className="min-w-0 flex-1 truncate text-linen/90">{p.name}</span>
        <button
          onClick={async () => {
            await api(`/api/projects/${p.id}`, 'PATCH', { status: 'paused' });
            router.refresh();
          }}
          title="Archive — hides it everywhere, tasks stay"
          className="text-xs text-hush transition-colors hover:text-linen"
        >
          archive
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
          <input value={name} onChange={(e) => setName(e.target.value)} className={`w-40 ${inputCls}`} />
          {p.kind === 'project' && (
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputCls}>
              <option value="">no area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  under {a.name}
                </option>
              ))}
            </select>
          )}
          <button disabled={busy} className={primaryBtn}>
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-moth hover:text-linen"
          >
            cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await api(`/api/projects/${p.id}`, 'DELETE');
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

function ArchivedRow({ p }: { p: Project }) {
  const router = useRouter();
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm text-moth">
      <span className="w-12 shrink-0 text-[10px] tracking-wider text-moth/50 uppercase">{p.kind}</span>
      <span className="min-w-0 flex-1 truncate">{p.name}</span>
      <span className="text-[10px] text-moth/60">{p.status}</span>
      <button
        onClick={async () => {
          await api(`/api/projects/${p.id}`, 'PATCH', { status: 'active' });
          router.refresh();
        }}
        className="text-xs transition-colors hover:text-linen"
      >
        reopen
      </button>
    </li>
  );
}

function AddProject({ areas }: { areas: Project[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'area' | 'project'>('area');
  const [parentId, setParentId] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await api('/api/projects', 'POST', {
      name: name.trim(),
      kind,
      parentId: kind === 'project' ? parentId || null : null,
    });
    setName('');
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-moth transition-colors hover:text-ember">
        + add an area or project
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={kind === 'area' ? 'Startup, job hunt, IoT lab…' : 'Whisper (rust)…'}
        autoFocus
        className={`w-44 ${inputCls}`}
      />
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as 'area' | 'project')}
        className={inputCls}
      >
        <option value="area">area — ongoing, never ends</option>
        <option value="project">project — has an end</option>
      </select>
      {kind === 'project' && (
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputCls}>
          <option value="">no area</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              under {a.name}
            </option>
          ))}
        </select>
      )}
      <button disabled={busy} className={primaryBtn}>
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-moth hover:text-linen">
        cancel
      </button>
    </form>
  );
}

// Shared schedule editor state: either a set of fixed days or a ×N/week target.
function ScheduleFields({
  mode,
  setMode,
  days,
  setDays,
  target,
  setTarget,
}: {
  mode: 'days' | 'target';
  setMode: (m: 'days' | 'target') => void;
  days: number[];
  setDays: (d: number[]) => void;
  target: string;
  setTarget: (t: string) => void;
}) {
  return (
    <>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as 'days' | 'target')}
        className={inputCls}
      >
        <option value="days">fixed days</option>
        <option value="target">times per week</option>
      </select>
      {mode === 'days' ? (
        <div className="flex gap-1">
          {DAY_NAMES.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}
              className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                days.includes(i)
                  ? 'border-ember/60 bg-ember/15 text-ember'
                  : 'border-seam text-moth hover:border-hush'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      ) : (
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="×/week"
          inputMode="numeric"
          className={`w-20 ${inputCls}`}
        />
      )}
    </>
  );
}

function scheduleBody(mode: 'days' | 'target', days: number[], target: string) {
  return mode === 'days'
    ? { daysOfWeek: days, timesPerWeek: null }
    : { daysOfWeek: null, timesPerWeek: Number(target) };
}

function RoutineRow({ r }: { r: Routine }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name);
  const [mode, setMode] = useState<'days' | 'target'>(r.daysOfWeek?.length ? 'days' : 'target');
  const [days, setDays] = useState<number[]>(r.daysOfWeek ?? []);
  const [target, setTarget] = useState(r.timesPerWeek?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await api(`/api/routines/${r.id}`, 'PATCH', {
      name: name.trim() || r.name,
      ...scheduleBody(mode, days, target),
    });
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <li className={`space-y-1.5 px-4 py-2.5 ${r.active ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-3 text-sm">
        <span className="min-w-0 flex-1 truncate text-linen/90">{r.name}</span>
        <span className="shrink-0 font-mono text-[10px] text-moth/80">
          {r.timesPerWeek ? `×${r.timesPerWeek}/wk` : r.daysOfWeek?.map((d) => DAY_NAMES[d]).join(' ')}
        </span>
        <button
          onClick={async () => {
            await api(`/api/routines/${r.id}`, 'PATCH', { active: !r.active });
            router.refresh();
          }}
          title={r.active ? 'Pause' : 'Resume'}
          className="text-xs text-hush transition-colors hover:text-linen"
        >
          {r.active ? '⏸' : '▶'}
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
          <ScheduleFields {...{ mode, setMode, days, setDays, target, setTarget }} />
          <button disabled={busy} className={primaryBtn}>
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-moth hover:text-linen"
          >
            cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await api(`/api/routines/${r.id}`, 'DELETE');
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

function AddRoutine() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'days' | 'target'>('days');
  const [days, setDays] = useState<number[]>([]);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const valid = mode === 'days' ? days.length > 0 : Number(target) >= 1;
    if (!name.trim() || !valid) return;
    setBusy(true);
    await api('/api/routines', 'POST', { name: name.trim(), ...scheduleBody(mode, days, target) });
    setName('');
    setDays([]);
    setTarget('');
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-moth transition-colors hover:text-ember">
        + add a routine
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Football, gym…"
        autoFocus
        className={`w-36 ${inputCls}`}
      />
      <ScheduleFields {...{ mode, setMode, days, setDays, target, setTarget }} />
      <button disabled={busy} className={primaryBtn}>
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-moth hover:text-linen">
        cancel
      </button>
    </form>
  );
}
