'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Organize } from './organize';

export type Task = {
  id: string;
  title: string;
  status: string;
  priority: number;
  due: string | null;
  projectId: string | null;
  aiProposed: boolean;
};

export type Project = {
  id: string;
  name: string;
  kind: 'area' | 'project';
  status: 'active' | 'done' | 'paused';
  parentId: string | null;
  staleDays: number | null; // days since a task moved here; null = never had one
};

export type Routine = {
  id: string;
  name: string;
  daysOfWeek: number[] | null;
  timesPerWeek: number | null;
  projectId: string | null;
  active: boolean;
  doneToday: boolean;
  doneThisWeek: number;
};

export const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const inputCls =
  'rounded-lg border border-seam bg-veil px-3 py-2 text-sm text-linen placeholder:text-moth/60 outline-none transition-colors focus:border-ember/60';
const primaryBtn =
  'rounded-lg bg-ember px-4 py-2 text-sm font-medium text-night transition hover:brightness-110 disabled:opacity-50';

async function api(path: string, method: string, body?: Record<string, unknown>) {
  await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function TaskList({
  today,
  tasks,
  projects,
  routines,
}: {
  today: string;
  tasks: Task[];
  projects: Project[];
  routines: Routine[];
}) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await api('/api/tasks', 'POST', { title: title.trim(), projectId });
    setTitle('');
    setBusy(false);
    router.refresh();
  }

  const patch = async (id: string, body: Record<string, unknown>) => {
    await api(`/api/tasks/${id}`, 'PATCH', body);
    router.refresh();
  };

  const toggleRoutine = async (id: string) => {
    await api(`/api/routines/${id}/done`, 'POST');
    router.refresh();
  };

  // pick a group from a section header: preselect its chip and focus quick-add
  const addInto = (id: string) => {
    setProjectId(id);
    inputRef.current?.focus();
  };

  const proposed = tasks.filter((t) => t.aiProposed && t.status !== 'done');
  const open = tasks.filter((t) => !t.aiProposed && t.status !== 'done' && t.status !== 'dropped');
  const done = tasks.filter((t) => t.status === 'done');

  // Today = what you committed to (status) or what the calendar says (due).
  const isToday = (t: Task) => t.status === 'today' || t.status === 'doing' || (!!t.due && t.due <= today);
  const todayTasks = open.filter(isToday);
  const laterTasks = open.filter((t) => !isToday(t));

  // A routine shows in Today while it still wants attention this week — or to let
  // you un-tap a completion made earlier today.
  const routinesDue = routines.filter(
    (r) =>
      r.active &&
      (r.doneToday || (r.daysOfWeek ? r.daysOfWeek.includes(dow) : r.doneThisWeek < (r.timesPerWeek ?? 0))),
  );

  const areas = projects.filter((p) => p.kind === 'area' && p.status === 'active');
  const activeProjects = projects.filter((p) => p.kind === 'project' && p.status === 'active');
  const areaIds = new Set(areas.map((a) => a.id));
  const standalone = activeProjects.filter((p) => !p.parentId || !areaIds.has(p.parentId));
  const childrenOf = (areaId: string) => activeProjects.filter((p) => p.parentId === areaId);

  const nameOf = new Map(projects.map((p) => [p.id, p.name]));
  const tasksIn = (id: string) => laterTasks.filter((t) => t.projectId === id);
  const inbox = laterTasks.filter((t) => !t.projectId || !nameOf.has(t.projectId));
  const chips = [...areas, ...activeProjects];

  return (
    <div className="space-y-8">
      <form onSubmit={addTask} className="space-y-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task…"
            className={`flex-1 ${inputCls}`}
          />
          <button disabled={busy} className={primaryBtn}>
            Add
          </button>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProjectId(projectId === p.id ? null : p.id)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  projectId === p.id
                    ? 'border-ember/60 bg-ember/15 text-ember'
                    : 'border-seam text-moth hover:border-hush hover:text-linen'
                }`}
              >
                {p.kind === 'project' ? '◆ ' : ''}
                {p.name}
              </button>
            ))}
          </div>
        )}
      </form>

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

      <section>
        <h2 className="mb-3 text-xs font-medium tracking-widest text-moth uppercase">Today</h2>
        {routinesDue.length === 0 && todayTasks.length === 0 ? (
          <p className="text-sm text-moth">
            Nothing planned today. Pull something up from below, or enjoy it.
          </p>
        ) : (
          <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
            {routinesDue.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <button
                  onClick={() => toggleRoutine(r.id)}
                  title={r.doneToday ? 'Undo today' : 'Did it'}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] transition-colors ${
                    r.doneToday
                      ? 'border-sage bg-sage/30 text-sage'
                      : 'border-hush hover:border-sage hover:bg-sage/30'
                  }`}
                >
                  {r.doneToday ? '✓' : ''}
                </button>
                <span className={`flex-1 ${r.doneToday ? 'text-moth' : 'text-linen/90'}`}>{r.name}</span>
                <span className="font-mono text-[10px] text-moth/80">
                  {r.timesPerWeek
                    ? `${r.doneThisWeek} of ${r.timesPerWeek} this week`
                    : r.daysOfWeek?.map((d) => DAY_NAMES[d]).join(' ')}
                </span>
              </li>
            ))}
            {todayTasks.map((t) => (
              <TaskRow
                key={t.id}
                t={t}
                patch={patch}
                tag={t.projectId ? nameOf.get(t.projectId) : undefined}
                inToday
              />
            ))}
          </ul>
        )}
      </section>

      {(areas.length > 0 || standalone.length > 0) && (
        <section className="space-y-5">
          <h2 className="text-xs font-medium tracking-widest text-moth uppercase">Areas & projects</h2>
          {areas.map((a) => (
            <div key={a.id} className="space-y-2">
              <Group p={a} count={tasksIn(a.id).length} onAdd={() => addInto(a.id)} />
              <TaskGroupList items={tasksIn(a.id)} patch={patch} />
              {childrenOf(a.id).map((p) => (
                <div key={p.id} className="ml-4 space-y-2 border-l border-seam/60 pl-3">
                  <Group p={p} count={tasksIn(p.id).length} onAdd={() => addInto(p.id)} />
                  <TaskGroupList items={tasksIn(p.id)} patch={patch} />
                </div>
              ))}
            </div>
          ))}
          {standalone.map((p) => (
            <div key={p.id} className="space-y-2">
              <Group p={p} count={tasksIn(p.id).length} onAdd={() => addInto(p.id)} />
              <TaskGroupList items={tasksIn(p.id)} patch={patch} />
            </div>
          ))}
        </section>
      )}

      {inbox.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-medium tracking-widest text-moth uppercase">Inbox</h2>
          <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
            {inbox.map((t) => (
              <TaskRow key={t.id} t={t} patch={patch} />
            ))}
          </ul>
        </section>
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
                {t.projectId && nameOf.has(t.projectId) && (
                  <span className="text-xs text-moth/70">{nameOf.get(t.projectId)}</span>
                )}
                <button
                  onClick={() => patch(t.id, { status: 'inbox' })}
                  className="text-xs text-moth transition-colors hover:text-linen"
                >
                  reopen
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Organize projects={projects} routines={routines} areas={areas} />
    </div>
  );
}

// Area/project section header: name · open count · stale badge · finish (projects only).
function Group({ p, count, onAdd }: { p: Project; count: number; onAdd: () => void }) {
  const router = useRouter();
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-sm font-medium text-linen">
        {p.kind === 'project' ? '◆ ' : ''}
        {p.name}
      </span>
      <span className="font-mono text-xs text-moth/80">{count}</span>
      {p.staleDays != null && p.staleDays >= 5 && (
        <span
          className="rounded-full bg-ember/15 px-2 py-0.5 text-[10px] text-ember"
          title="Days since a task moved here"
        >
          quiet {p.staleDays}d
        </span>
      )}
      <button
        onClick={onAdd}
        title={`Add a task to ${p.name}`}
        className="text-xs text-hush transition-colors hover:text-ember"
      >
        + task
      </button>
      {p.kind === 'project' && (
        <button
          onClick={async () => {
            await api(`/api/projects/${p.id}`, 'PATCH', { status: 'done' });
            router.refresh();
          }}
          title="Mark project finished"
          className="ml-auto text-xs text-hush transition-colors hover:text-sage"
        >
          ✓ finish
        </button>
      )}
    </div>
  );
}

function TaskGroupList({
  items,
  patch,
}: {
  items: Task[];
  patch: (id: string, body: Record<string, unknown>) => void;
}) {
  if (items.length === 0) {
    return <p className="px-1 text-xs text-moth/60">nothing open</p>;
  }
  return (
    <ul className="divide-y divide-seam/60 rounded-xl border border-seam bg-veil/50">
      {items.map((t) => (
        <TaskRow key={t.id} t={t} patch={patch} />
      ))}
    </ul>
  );
}

function TaskRow({
  t,
  patch,
  tag,
  inToday = false,
}: {
  t: Task;
  patch: (id: string, body: Record<string, unknown>) => void;
  tag?: string;
  inToday?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 text-sm">
      <button
        onClick={() => patch(t.id, { status: 'done' })}
        title="Mark done"
        className="h-4 w-4 shrink-0 rounded-full border border-hush transition-colors hover:border-sage hover:bg-sage/30"
      />
      <span className="min-w-0 flex-1 truncate text-linen/90">{t.title}</span>
      {tag && (
        <span className="shrink-0 rounded-full bg-seam/80 px-2 py-0.5 text-[10px] text-moth">{tag}</span>
      )}
      {t.due && <span className="shrink-0 font-mono text-xs text-moth">{t.due}</span>}
      {inToday ? (
        <button
          onClick={() => patch(t.id, { status: 'inbox', due: null })}
          title="Push back to the backlog"
          className="shrink-0 text-xs text-hush transition-colors hover:text-linen"
        >
          later
        </button>
      ) : (
        <button
          onClick={() => patch(t.id, { status: 'today' })}
          title="Pull into today"
          className="shrink-0 text-xs text-hush transition-colors hover:text-ember"
        >
          today
        </button>
      )}
      <button
        onClick={() => patch(t.id, { status: 'dropped' })}
        title="Drop"
        className="shrink-0 text-hush transition-colors hover:text-rose"
      >
        ✕
      </button>
    </li>
  );
}
