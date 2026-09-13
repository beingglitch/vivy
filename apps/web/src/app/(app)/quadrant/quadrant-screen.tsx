'use client';

import { useState, useTransition } from 'react';
import type { Area } from '@/lib/areas';
import type { Task } from '@/lib/tasks';
import { EFFORTS, IMPORTANCE } from '@/lib/task-scales';
import { PlusIcon } from '@/components/icons';
import { addTask, completeTask, removeTask } from './actions';

/**
 * The grid is drawn whether or not anything sits in it.
 *
 * It is the structure of the screen rather than a chart that needs data: the
 * labelled axes and the tinted corner are what explain the idea, so an empty
 * grid teaches where work will land.
 */
export function QuadrantScreen({ tasks, areas }: { tasks: Task[]; areas: Area[] }) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);

  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Quadrant</h1>
            <span className="subtitle">
              {tasks.length === 0
                ? 'Nothing open'
                : `${tasks.length} open task${tasks.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <button
            className="iconbtn"
            aria-label={adding ? 'Cancel' : 'New task'}
            onClick={() => {
              setAdding((v) => !v);
              setSelected(null);
            }}
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="screen screen--flush">
        <div style={{ padding: '0 20px', display: 'flex', gap: 8 }}>
          <div className="axis-y">
            <span>Important + due</span>
          </div>
          <div className="quadrant">
            {/* Top-left is tinted: important and quick, the place to look first. */}
            <div className="quadrant__hot" />
            <div className="quadrant__vline" />
            <div className="quadrant__hline" />

            {tasks.map((task) => (
              <button
                key={task.id}
                className="quadrant__task"
                style={{
                  left: `${task.x}%`,
                  top: `${task.y}%`,
                  width: task.size,
                  height: task.size,
                  background: task.areaColour ?? '#8A8A90',
                  outline: selected?.id === task.id ? '2px solid var(--ink)' : 'none',
                  outlineOffset: 2,
                }}
                aria-label={`${task.title}. ${importanceLabel(task.importance)}, ${effortLabel(task.effortMinutes)}`}
                onClick={() => setSelected(selected?.id === task.id ? null : task)}
              />
            ))}
          </div>
        </div>

        <div className="axis-x">
          <span>5 min</span>
          <span className="axis-x__label">Time to finish</span>
          <span>4 h +</span>
        </div>

        {selected ? (
          <TaskCard task={selected} onClose={() => setSelected(null)} />
        ) : (
          <p className="quadrant__note">
            {tasks.length === 0
              ? 'Open tasks appear here as dots, placed by how important they are against how long they take. Bigger dot, longer job.'
              : 'Tap a dot to see the task. Top left is important and quick, so start there.'}
          </p>
        )}

        {adding ? <TaskForm areas={areas} onDone={() => setAdding(false)} /> : null}

        {tasks.length > 0 ? (
          <ul className="qlist">
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskRow task={task} onSelect={() => setSelected(task)} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}

function TaskRow({ task, onSelect }: { task: Task; onSelect: () => void }) {
  const [pending, start] = useTransition();

  return (
    <div className="task">
      <button
        className="task__box"
        aria-label={`Complete ${task.title}`}
        disabled={pending}
        onClick={() => start(() => void completeTask(task.id))}
      />
      <button className="task__body" onClick={onSelect}>
        <span className="task__title">{task.title}</span>
        <span className="task__meta">
          {task.areaName ? `${task.areaName} · ` : ''}
          {importanceLabel(task.importance)} · {effortLabel(task.effortMinutes)}
          {task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString('en-GB')}` : ''}
        </span>
      </button>
    </div>
  );
}

function TaskCard({ task, onClose }: { task: Task; onClose: () => void }) {
  const [pending, start] = useTransition();

  return (
    <div className="qcard">
      <div className="qcard__head">
        <span className="dot" style={{ background: task.areaColour ?? '#8A8A90' }} />
        <span className="qcard__title">{task.title}</span>
      </div>
      <p className="qcard__meta">
        {task.areaName ?? 'Unfiled'} · {importanceLabel(task.importance)} ·{' '}
        {effortLabel(task.effortMinutes)}
        {task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString('en-GB')}` : ''}
      </p>
      <div className="qcard__actions">
        <button
          className="btn btn--primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await completeTask(task.id);
              onClose();
            })
          }
        >
          Done
        </button>
        <button
          className="btn btn--quiet"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await removeTask(task.id);
              onClose();
            })
          }
        >
          Delete
        </button>
        <button className="btn btn--quiet" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function TaskForm({ areas, onDone }: { areas: Area[]; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [areaId, setAreaId] = useState<string | null>(areas[0]?.id ?? null);
  const [importance, setImportance] = useState(2);
  const [effort, setEffort] = useState(30);
  const [due, setDue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="areaform">
      <div className="field">
        <label className="field__label" htmlFor="t-title">
          Task
        </label>
        <input
          id="t-title"
          className="field__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          autoComplete="off"
        />
      </div>

      {areas.length > 0 ? (
        <>
          <span className="field__label">Area</span>
          <div className="chips">
            {areas.map((a) => (
              <button
                key={a.id}
                className={`chip${a.id === areaId ? ' chip--on' : ''}`}
                onClick={() => setAreaId(a.id)}
              >
                {a.name}
              </button>
            ))}
            <button
              className={`chip${areaId === null ? ' chip--on' : ''}`}
              onClick={() => setAreaId(null)}
            >
              Unfiled
            </button>
          </div>
        </>
      ) : (
        <p className="src__controlNote">
          No focus areas yet. Add one in More, Focus areas, and tasks get its colour.
        </p>
      )}

      <span className="field__label">How important</span>
      <div className="chips">
        {IMPORTANCE.map((i) => (
          <button
            key={i.value}
            className={`chip${i.value === importance ? ' chip--on' : ''}`}
            onClick={() => setImportance(i.value)}
          >
            {i.label}
          </button>
        ))}
      </div>

      <span className="field__label">How long</span>
      <div className="chips">
        {EFFORTS.map((e) => (
          <button
            key={e.value}
            className={`chip${e.value === effort ? ' chip--on' : ''}`}
            onClick={() => setEffort(e.value)}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="t-due">
          Due (optional)
        </label>
        <input
          id="t-due"
          type="date"
          className="field__input"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </div>

      {error ? <p className="pair__error">{error}</p> : null}

      <div className="areaform__actions">
        <button
          className="btn btn--primary"
          disabled={pending || !title.trim()}
          onClick={() => {
            setError(null);
            start(async () => {
              const result = await addTask({
                title,
                areaId,
                importance,
                effortMinutes: effort,
                dueAt: due || null,
              });
              if (!result.ok) return setError(result.error);
              onDone();
            });
          }}
        >
          {pending ? 'Adding…' : 'Add task'}
        </button>
        <button className="btn btn--quiet" disabled={pending} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function importanceLabel(v: number) {
  return IMPORTANCE.find((i) => i.value === v)?.label ?? 'Normal';
}

function effortLabel(v: number) {
  return EFFORTS.find((e) => e.value === v)?.label ?? `${v} min`;
}
