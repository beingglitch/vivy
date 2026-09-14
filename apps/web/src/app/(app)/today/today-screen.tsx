'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Area } from '@/lib/areas';
import type { Task } from '@/lib/tasks';
import { Empty } from '@/components/empty';
import { CheckIcon } from '@/components/icons';
import {
  addTask,
  completeTask,
  moveTomorrow,
  removeTask,
  reopenTask,
} from '@/app/(app)/quadrant/actions';
import { TaskForm } from '@/app/(app)/quadrant/task-form';
import { Composer, TabBar } from '@/components/shell';
import { SwipeTask } from '@/components/swipe-task';

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
  googleMapsApiKey,
}: {
  open: Task[];
  done: Task[];
  areas: Area[];
  day: string;
  googleMapsApiKey: string;
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
  const groups = new Map<
    string,
    { name: string; colour: string; tasks: { task: Task; done: boolean }[] }
  >();
  for (const [tasks, isDone] of [
    [open, false],
    [done, true],
  ] as const) {
    for (const task of tasks) {
      const key = task.areaId ?? 'unfiled';
      const group = groups.get(key) ?? {
        name: task.areaName ?? 'Unfiled',
        colour: task.areaColour ?? '#8A8A90',
        tasks: [],
      };
      group.tasks.push({ task, done: isDone });
      groups.set(key, group);
    }
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
            <strong>{group.name}</strong>
            <span className="todaygroup__count">
              {group.tasks.filter((item) => item.done).length}/{group.tasks.length}
            </span>
          </span>
          {group.tasks.map(({ task, done: taskDone }) => (
            <Row key={task.id} task={task} done={taskDone} onEdit={() => setEditing(task)} />
          ))}
        </section>
      ))}
      {editing ? (
        <TaskForm
          areas={areas}
          googleMapsApiKey={googleMapsApiKey}
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
  return (
    <SwipeTask
      label={task.title}
      onTap={() => (done ? reopenTask(task.id) : completeTask(task.id))}
      onHold={onEdit}
      onTomorrow={() => moveTomorrow(task.id)}
      onDelete={() => removeTask(task.id)}
    >
      <div className="task task--gesture">
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
    </SwipeTask>
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
