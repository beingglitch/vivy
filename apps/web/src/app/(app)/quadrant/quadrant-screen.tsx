'use client';

import { useRef, useState, useTransition } from 'react';
import type { Area } from '@/lib/areas';
import type { Task } from '@/lib/tasks';
import { EFFORTS, IMPORTANCE, unplace } from '@/lib/task-scales';
import { PlusIcon } from '@/components/icons';
import { archiveTask, completeTask, removeTask } from './actions';
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
  const [editing, setEditing] = useState<Task | null>(null);

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
              <TaskDot
                key={task.id}
                task={task}
                onEdit={() => {
                  setDraft(null);
                  setEditing(task);
                }}
              />
            ))}
          </div>
        </div>

        <div className="axis-x">
          <span>5 min</span>
          <span className="axis-x__label">Time to finish</span>
          <span>24 h</span>
        </div>

        <p className="quadrant__note">
          {tasks.length === 0
            ? 'Tap anywhere on the grid to add a task there. Left is quick, top is important.'
            : 'Tap a task to finish it. Hold it to edit, or use the list to swipe.'}
        </p>

        {draft ? (
          <TaskForm
            areas={areas}
            importance={draft.importance}
            effortMinutes={draft.effortMinutes}
            onDone={() => setDraft(null)}
          />
        ) : null}

        {editing ? (
          <TaskForm
            areas={areas}
            importance={editing.importance}
            effortMinutes={editing.effortMinutes}
            task={editing}
            onDone={() => setEditing(null)}
          />
        ) : null}

        {tasks.length > 0 ? (
          <ul className="qlist">
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskRow
                  task={task}
                  onEdit={() => {
                    setDraft(null);
                    setEditing(task);
                  }}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}

function TaskDot({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  return (
    <button
      className="quadrant__task"
      style={{
        left: `${task.x}%`,
        top: `${task.y}%`,
        width: task.size,
        height: task.size,
        background: task.areaColour ?? '#8A8A90',
      }}
      aria-label={`${task.title}. Tap to complete or press and hold to edit.`}
      disabled={pending}
      onPointerDown={() => {
        held.current = false;
        hold.current = setTimeout(() => {
          held.current = true;
          navigator.vibrate?.(30);
          onEdit();
        }, 550);
      }}
      onPointerUp={() => hold.current && clearTimeout(hold.current)}
      onPointerCancel={() => hold.current && clearTimeout(hold.current)}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        start(() => void completeTask(task.id));
      }}
    />
  );
}

function TaskRow({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const gesture = useRef<{ x: number; held: boolean; timer: ReturnType<typeof setTimeout> } | null>(
    null,
  );

  function finishGesture(event: React.PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active) return;
    clearTimeout(active.timer);
    gesture.current = null;
    if (active.held || pending) return;

    const distance = event.clientX - active.x;
    if (distance >= 72) return start(() => void archiveTask(task.id));
    if (distance <= -72) return start(() => void removeTask(task.id));
    start(() => void completeTask(task.id));
  }

  return (
    <div
      className="task task--gesture"
      role="button"
      tabIndex={0}
      aria-label={`${task.title}. Tap to complete, swipe right to archive, swipe left to delete, or press and hold to edit.`}
      onPointerDown={(event) => {
        if (pending) return;
        gesture.current = {
          x: event.clientX,
          held: false,
          timer: setTimeout(() => {
            if (!gesture.current) return;
            gesture.current.held = true;
            navigator.vibrate?.(30);
            onEdit();
          }, 550),
        };
      }}
      onPointerMove={(event) => {
        if (!gesture.current) return;
        if (Math.abs(event.clientX - gesture.current.x) > 10) {
          clearTimeout(gesture.current.timer);
        }
      }}
      onPointerUp={finishGesture}
      onPointerCancel={() => {
        if (gesture.current) clearTimeout(gesture.current.timer);
        gesture.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          start(() => void completeTask(task.id));
        }
      }}
    >
      <span className="task__box" aria-hidden />
      <div className="task__body">
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
