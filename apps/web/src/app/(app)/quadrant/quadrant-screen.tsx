'use client';

import { useRef, useState, useTransition } from 'react';
import type { Area } from '@/lib/areas';
import type { Task } from '@/lib/tasks';
import { SwipeTask } from '@/components/swipe-task';
import {
  EFFORTS,
  IMPORTANCE,
  MAX_EFFORT_MINUTES,
  MIN_EFFORT_MINUTES,
  quadrantFor,
  unplace,
} from '@/lib/task-scales';
import { completeTask, moveTomorrow, removeTask } from './actions';
import { TaskForm } from './task-form';

/**
 * The grid is drawn whether or not anything sits in it.
 *
 * It is the structure of the screen rather than a chart that needs data: the
 * labelled axes and the tinted corner are what explain the idea, so an empty
 * grid teaches where work will land.
 */
export function QuadrantScreen({
  tasks,
  areas,
  googleMapsApiKey,
}: {
  tasks: Task[];
  areas: Area[];
  googleMapsApiKey: string;
}) {
  // Where the new task will land, taken from the tap. Null means the form is
  // closed; the centre is used when it is opened from the header button
  // instead, because that gesture says nothing about placement.
  const [draft, setDraft] = useState<{ importance: number; effortMinutes: number } | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftAreaId, setDraftAreaId] = useState<string | null>(null);
  const [placingDetails, setPlacingDetails] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filtering, setFiltering] = useState(false);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const visibleTasks = areaFilter ? tasks.filter((task) => task.areaId === areaFilter) : tasks;
  const selectedArea = areas.find((area) => area.id === areaFilter);
  const draftArea = areas.find((area) => area.id === draftAreaId);
  const draftPoint = draft ? scalePoint(draft.importance, draft.effortMinutes) : null;

  function closeDraft() {
    setDraft(null);
    setDraftTitle('');
    setPlacingDetails(false);
    setHoverPoint(null);
  }

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
    const nextDraft = unplace(x, y);
    const tappedQuadrant = `${y < 50 ? 'top' : 'bottom'}-${x < 50 ? 'left' : 'right'}`;
    if (draft && quadrantFor(draft.importance, draft.effortMinutes) === tappedQuadrant) {
      closeDraft();
      return;
    }
    if (!draft) setDraftAreaId(areaFilter ?? areas[0]?.id ?? null);
    setEditing(null);
    setPlacingDetails(false);
    setHoverPoint(null);
    setDraft(nextDraft);
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
            type="button"
            className="quadrant-filter"
            aria-expanded={filtering}
            onClick={() => setFiltering((current) => !current)}
          >
            <span className="dot" style={{ background: selectedArea?.colour ?? 'var(--accent)' }} />
            <span>{selectedArea?.name ?? 'All areas'}</span>
          </button>
        </div>
      </div>

      <div className="screen screen--flush">
        {filtering ? (
          <div className="quadrant-area-filter chips">
            <button
              type="button"
              className="chip"
              aria-selected={areaFilter === null}
              onClick={() => {
                setAreaFilter(null);
                setFiltering(false);
              }}
            >
              All areas
            </button>
            {areas.map((area) => (
              <button
                type="button"
                key={area.id}
                className="chip"
                aria-selected={areaFilter === area.id}
                onClick={() => {
                  setAreaFilter(area.id);
                  if (draft) setDraftAreaId(area.id);
                  setFiltering(false);
                }}
              >
                <span className="dot" style={{ background: area.colour }} />
                {area.name}
              </button>
            ))}
          </div>
        ) : null}
        <div style={{ padding: '0 20px', display: 'flex', gap: 8 }}>
          <div className="axis-y">
            <span>Important + due</span>
          </div>
          <div
            className="quadrant"
            onClick={tapGrid}
            onPointerMove={(event) => {
              if (event.pointerType !== 'mouse') return;
              const box = event.currentTarget.getBoundingClientRect();
              setHoverPoint({
                x: Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100)),
                y: Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100)),
              });
            }}
            onPointerLeave={() => setHoverPoint(null)}
            role="presentation"
          >
            {/* Top-left is tinted: important and quick, the place to look first. */}
            <div className="quadrant__hot" />
            {hoverPoint && !draft ? (
              <div
                className="quadrant__hover"
                style={
                  {
                    '--hover-x': `${hoverPoint.x}%`,
                    '--hover-y': `${hoverPoint.y}%`,
                    '--hover-colour': draftArea?.colour ?? selectedArea?.colour ?? 'var(--accent)',
                  } as React.CSSProperties
                }
                aria-hidden
              >
                <span className="quadrant__hover-v" />
                <span className="quadrant__hover-h" />
              </div>
            ) : null}
            {draft && draftPoint ? (
              <div
                className="quadrant__selection"
                style={
                  {
                    '--selection-x': `${draftPoint.x}%`,
                    '--selection-y': `${draftPoint.y}%`,
                    '--selection-colour':
                      draftArea?.colour ?? selectedArea?.colour ?? 'var(--accent)',
                  } as React.CSSProperties
                }
                aria-hidden
              >
                <span className="quadrant__selection-v" />
                <span className="quadrant__selection-h" />
                <span className="quadrant__selection-dot" />
                <span className="quadrant__selection-label">
                  {importanceLabel(draft.importance).toLowerCase()} ·{' '}
                  {effortLabel(draft.effortMinutes)}
                </span>
              </div>
            ) : null}
            <div className="quadrant__vline" />
            <div className="quadrant__hline" />
            <span className="quadrant__label quadrant__label--top-left">Do now</span>
            <span className="quadrant__label quadrant__label--top-right">Schedule a block</span>
            <span className="quadrant__label quadrant__label--bottom-left">Batch</span>
            <span className="quadrant__label quadrant__label--bottom-right">Drop</span>

            {visibleTasks.map((task) => (
              <TaskDot
                key={task.id}
                task={task}
                onEdit={() => {
                  closeDraft();
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

        {draft && !placingDetails ? (
          <form
            className="quadrant-compose"
            onSubmit={(event) => {
              event.preventDefault();
              if (draftTitle.trim()) setPlacingDetails(true);
            }}
          >
            <div className="quadrant-compose__head">
              <span>New task here</span>
              <span>
                {importanceLabel(draft.importance)} · {effortLabel(draft.effortMinutes)}
              </span>
            </div>
            <input
              className="quadrant-compose__input"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="What needs doing?"
              aria-label="New task title"
              enterKeyHint="next"
              autoComplete="off"
              autoFocus
            />
            <div className="quadrant-compose__areas" aria-label="Focus area">
              {areas.map((area) => (
                <button
                  type="button"
                  key={area.id}
                  className={`quadrant-compose__area${
                    draftAreaId === area.id ? ' quadrant-compose__area--on' : ''
                  }`}
                  style={{ '--area-colour': area.colour } as React.CSSProperties}
                  onClick={() => setDraftAreaId(area.id)}
                >
                  <span className="dot" style={{ background: area.colour }} />
                  {area.name}
                </button>
              ))}
              <button
                type="button"
                className={`quadrant-compose__area${
                  draftAreaId === null ? ' quadrant-compose__area--on' : ''
                }`}
                style={{ '--area-colour': '#8a8a90' } as React.CSSProperties}
                onClick={() => setDraftAreaId(null)}
              >
                <span className="dot" style={{ background: '#8a8a90' }} />
                Unfiled
              </button>
            </div>
          </form>
        ) : null}

        {draft && placingDetails ? (
          <TaskForm
            areas={areas}
            googleMapsApiKey={googleMapsApiKey}
            initialTitle={draftTitle.trim()}
            initialAreaId={draftAreaId}
            importance={draft.importance}
            effortMinutes={draft.effortMinutes}
            onQuadrantChange={setDraft}
            onDone={closeDraft}
          />
        ) : null}

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

        {visibleTasks.length > 0 ? (
          <div className="quadrant-list">
            <div className="quadrant-list__head">
              <strong>{selectedArea?.name ?? 'Open tasks'}</strong>
              <span>
                {visibleTasks.length} task{visibleTasks.length === 1 ? '' : 's'} ·{' '}
                {effortLabel(visibleTasks.reduce((total, task) => total + task.effortMinutes, 0))}
              </span>
            </div>
            <ul className="qlist">
              {visibleTasks.map((task) => (
                <li key={task.id}>
                  <TaskRow
                    task={task}
                    onEdit={() => {
                      closeDraft();
                      setEditing(task);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </>
  );
}

function scalePoint(importance: number, effortMinutes: number) {
  const minutes = Math.min(Math.max(effortMinutes, MIN_EFFORT_MINUTES), MAX_EFFORT_MINUTES);
  const x =
    ((Math.log(minutes) - Math.log(MIN_EFFORT_MINUTES)) /
      (Math.log(MAX_EFFORT_MINUTES) - Math.log(MIN_EFFORT_MINUTES))) *
    100;
  const weight = (importance - 1) / 3;
  return { x: 6 + x * 0.88, y: 6 + (1 - weight) * 88 };
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
  return (
    <SwipeTask
      label={task.title}
      onTap={() => completeTask(task.id)}
      onHold={onEdit}
      onTomorrow={() => moveTomorrow(task.id)}
      onDelete={() => removeTask(task.id)}
    >
      <div className="task task--gesture">
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
    </SwipeTask>
  );
}

function importanceLabel(v: number) {
  return IMPORTANCE.find((i) => i.value === v)?.label ?? 'Normal';
}

function effortLabel(v: number) {
  return EFFORTS.find((e) => e.value === v)?.label ?? `${v} min`;
}
