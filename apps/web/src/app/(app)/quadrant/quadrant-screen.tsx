'use client';

import { useState, useTransition } from 'react';
import type { Area } from '@/lib/areas';
import type { Task } from '@/lib/tasks';
import { EFFORTS, IMPORTANCE, unplace } from '@/lib/task-scales';
import { PlusIcon } from '@/components/icons';
import { completeTask, removeTask } from './actions';
import { TaskForm } from './task-form';

/**
 * The grid is drawn whether or not anything sits in it.
 *
 * It is the structure of the screen rather than a chart that needs data: the
 * labelled axes and the tinted corner are what explain the idea, so an empty
 * grid teaches where work will land.
 */
export function QuadrantScreen({ tasks, areas }: { tasks: Task[]; areas: Area[] }) {
  // Where the new task will land, taken from the tap. Null means the form is
  // closed; the centre is used when it is opened from the header button
  // instead, because that gesture says nothing about placement.
  const [draft, setDraft] = useState<{ importance: number; effortMinutes: number } | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);

  /**
   * Tapping the grid says both numbers at once.
   *
   * The position is read from the element rather than the event's page
   * coordinates, so it stays correct inside a scrolled screen and at any
   * width.
   */
  function tapGrid(event: React.MouseEvent<HTMLDivElement>) {
    // Ignore taps that landed on a dot; those select rather than create.
    if ((event.target as HTMLElement).closest('.quadrant__task')) return;

    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 100;
    const y = ((event.clientY - box.top) / box.height) * 100;
    setSelected(null);
    setDraft(unplace(x, y));
  }

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
            aria-label={draft ? 'Cancel' : 'New task'}
            onClick={() => {
              setSelected(null);
              // Middle of the board, since the button says nothing about where.
              setDraft(draft ? null : { importance: 2, effortMinutes: 30 });
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
          <div className="quadrant" onClick={tapGrid} role="presentation">
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
              ? 'Tap anywhere on the grid to add a task there. Left is quick, top is important.'
              : 'Tap a dot to open it, or an empty spot to add a task there.'}
          </p>
        )}

        {draft ? (
          <TaskForm
            areas={areas}
            importance={draft.importance}
            effortMinutes={draft.effortMinutes}
            onDone={() => setDraft(null)}
          />
        ) : null}

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
        <span className="task__title">
          {task.title}
          {task.behind ? <span className="behind">behind</span> : null}
        </span>
        <span className="task__meta">
          {task.areaName ? `${task.areaName} · ` : ''}
          {importanceLabel(task.importance)} · {effortLabel(task.effortMinutes)}
          {task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString('en-GB')}` : ''}
          {task.placeLabel ? ` · ${task.placeLabel}` : ''}
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

function importanceLabel(v: number) {
  return IMPORTANCE.find((i) => i.value === v)?.label ?? 'Normal';
}

function effortLabel(v: number) {
  return EFFORTS.find((e) => e.value === v)?.label ?? `${v} min`;
}
