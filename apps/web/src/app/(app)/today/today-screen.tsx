'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Area } from '@/lib/areas';
import type { Task } from '@/lib/tasks';
import { Empty } from '@/components/empty';
import { CheckIcon } from '@/components/icons';
import { addTask, completeTask, reopenTask } from '@/app/(app)/quadrant/actions';
import { TaskForm } from '@/app/(app)/quadrant/task-form';
import { Composer, TabBar } from '@/components/shell';

/**
 * Today.
 *
 * Grouped by area, because that is how the day actually divides. Anything with
 * no area falls into one group at the end rather than being hidden.
 */
export function TodayScreen({
  open,
  done,
  areas,
  day,
}: {
  open: Task[];
  done: Task[];
  areas: Area[];
  day: string;
}) {
  const [editing, setEditing] = useState<Task | null>(null);
  const router = useRouter();
  const swipe = useRef<number | null>(null);

  function moveDay(distance: number) {
    if (Math.abs(distance) < 72) return;
    const next = new Date(`${day}T12:00:00`);
    next.setDate(next.getDate() + (distance < 0 ? 1 : -1));
    router.push(`/today?day=${next.toLocaleDateString('en-CA')}`);
  }
  const groups = new Map<string, { name: string; colour: string; tasks: Task[] }>();
  for (const task of open) {
    const key = task.areaId ?? 'unfiled';
    const group = groups.get(key) ?? {
      name: task.areaName ?? 'Unfiled',
      colour: task.areaColour ?? '#8A8A90',
      tasks: [],
    };
    group.tasks.push(task);
    groups.set(key, group);
  }

  return (
    <div
      className="todaylist todaylist--swipe"
      onPointerDown={(event) => {
        swipe.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (swipe.current !== null) moveDay(event.clientX - swipe.current);
        swipe.current = null;
      }}
      onPointerCancel={() => {
        swipe.current = null;
      }}
    >
      {open.length === 0 && done.length === 0 ? (
        <Empty title="Nothing planned" hint="Swipe to another day or add a task." />
      ) : null}
      {[...groups.values()].map((group) => (
        <section key={group.name} className="todaygroup">
          <span className="todaygroup__head">
            <span className="dot" style={{ background: group.colour }} />
            {group.name}
          </span>
          {group.tasks.map((task) => (
            <Row key={task.id} task={task} done={false} onEdit={() => setEditing(task)} />
          ))}
        </section>
      ))}

      {done.length > 0 ? (
        <section className="todaygroup">
          <span className="todaygroup__head">Done</span>
          {done.map((task) => (
            <Row key={task.id} task={task} done onEdit={() => setEditing(task)} />
          ))}
        </section>
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
    </div>
  );
}

function Row({ task, done, onEdit }: { task: Task; done: boolean; onEdit: () => void }) {
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
    if (Math.abs(distance) >= 10) return;
    start(() => void (done ? reopenTask(task.id) : completeTask(task.id)));
  }

  return (
    <div
      className="task task--gesture"
      role="button"
      tabIndex={0}
      aria-label={`${task.title}. Tap to ${done ? 'reopen' : 'complete'} or press and hold to edit.`}
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
        if (Math.abs(event.clientX - gesture.current.x) > 10) clearTimeout(gesture.current.timer);
      }}
      onPointerUp={finishGesture}
      onPointerCancel={() => {
        if (gesture.current) clearTimeout(gesture.current.timer);
        gesture.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          start(() => void (done ? reopenTask(task.id) : completeTask(task.id)));
        }
      }}
    >
      <span className={`task__box${done ? ' task__box--done' : ''}`} aria-hidden>
        {done ? <CheckIcon /> : null}
      </span>
      <div className="task__body">
        <span className={`task__title${done ? ' task__title--done' : ''}`}>{task.title}</span>
        {!done ? (
          <span className="task__meta">
            {formatEffort(task.effortMinutes)}
            {task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString('en-GB')}` : ''}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function formatEffort(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}

/**
 * The capture bar, wired to create a task.
 *
 * Typed text becomes an unfiled task at the default importance and effort, so
 * catching a thought costs one line. Filing and sizing it happens later on the
 * quadrant, which is where those choices are actually visible.
 */
export function TodayDock() {
  return (
    <div className="dock">
      <Composer
        placeholder="Add a task…"
        onSubmit={async (text) => {
          await addTask({
            title: text,
            areaId: null,
            importance: 2,
            effortMinutes: 30,
            deadlineKind: 'none',
            dueAt: null,
            dueAmount: null,
            dueUnit: null,
            placeLabel: null,
            lat: null,
            lng: null,
            radiusM: null,
          });
        }}
      />
      <TabBar />
    </div>
  );
}
