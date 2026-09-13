'use client';

import { useTransition } from 'react';
import type { Task } from '@/lib/tasks';
import { Empty } from '@/components/empty';
import { CheckIcon } from '@/components/icons';
import { addTask, completeTask, reopenTask } from '@/app/(app)/quadrant/actions';
import { Composer, TabBar } from '@/components/shell';

/**
 * Today.
 *
 * Grouped by area, because that is how the day actually divides. Anything with
 * no area falls into one group at the end rather than being hidden.
 */
export function TodayScreen({ open, done }: { open: Task[]; done: Task[] }) {
  if (open.length === 0 && done.length === 0) {
    return (
      <Empty title="Nothing planned" hint="Tasks you add will show here, grouped by focus area." />
    );
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
    <div className="todaylist">
      {[...groups.values()].map((group) => (
        <section key={group.name} className="todaygroup">
          <span className="todaygroup__head">
            <span className="dot" style={{ background: group.colour }} />
            {group.name}
          </span>
          {group.tasks.map((task) => (
            <Row key={task.id} task={task} done={false} />
          ))}
        </section>
      ))}

      {done.length > 0 ? (
        <section className="todaygroup">
          <span className="todaygroup__head">Done</span>
          {done.map((task) => (
            <Row key={task.id} task={task} done />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Row({ task, done }: { task: Task; done: boolean }) {
  const [pending, start] = useTransition();

  return (
    <div className="task">
      <button
        className={`task__box${done ? ' task__box--done' : ''}`}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        disabled={pending}
        onClick={() =>
          start(() => void (done ? reopenTask(task.id) : completeTask(task.id)))
        }
      >
        {done ? <CheckIcon /> : null}
      </button>
      <div className="task__body">
        <span className={`task__title${done ? ' task__title--done' : ''}`}>{task.title}</span>
        {!done ? (
          <span className="task__meta">
            {task.effortMinutes < 60
              ? `${task.effortMinutes} min`
              : `${task.effortMinutes / 60} h`}
            {task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString('en-GB')}` : ''}
          </span>
        ) : null}
      </div>
    </div>
  );
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
            dueAt: null,
          });
        }}
      />
      <TabBar />
    </div>
  );
}
