'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { ChevronIcon, MoreIcon, PlusIcon } from '@/components/icons';
import { AREA_COLOURS } from '@/lib/area-colours';
import type { Area } from '@/lib/areas';
import type { Task } from '@/lib/tasks';
import { addArea, deleteArea, editArea, removeArea } from './actions';

type Sheet = 'create' | 'edit' | 'delete' | null;

export function AreasScreen({
  areas,
  openTasks,
  doneTasks,
}: {
  areas: Area[];
  openTasks: Task[];
  doneTasks: Task[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [managing, setManaging] = useState(false);
  const selected = areas.find((area) => area.id === selectedId) ?? null;
  const usedColours = areas.map((area) => area.colour);

  if (selected) {
    return (
      <>
        <AreaDetail
          area={selected}
          openTasks={openTasks.filter((task) => task.areaId === selected.id)}
          doneTasks={doneTasks.filter((task) => task.areaId === selected.id)}
          onBack={() => setSelectedId(null)}
          onEdit={() => setSheet('edit')}
        />
        {sheet === 'edit' ? (
          <AreaForm
            area={selected}
            usedColours={usedColours.filter((colour) => colour !== selected.colour)}
            onDelete={() => setSheet('delete')}
            onDone={() => setSheet(null)}
          />
        ) : null}
        {sheet === 'delete' ? (
          <DeleteAreaSheet
            area={selected}
            onDone={() => {
              setSheet(null);
              setSelectedId(null);
            }}
            onCancel={() => setSheet('edit')}
          />
        ) : null}
      </>
    );
  }

  const openCount = areas.reduce((total, area) => total + area.openTasks, 0);

  return (
    <>
      <div className="header areas-header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Focus areas</h1>
            <button
              type="button"
              className="subtitle areas-header__manage"
              onClick={() => setManaging(true)}
            >
              {areas.length} area{areas.length === 1 ? '' : 's'} · {openCount} open
            </button>
          </div>
          <button
            className="iconbtn"
            aria-label="New focus area"
            onClick={() => setSheet('create')}
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="screen screen--flush">
        <ul className="area-index">
          {areas.map((area) => (
            <li key={area.id}>
              <button
                type="button"
                className="area-index__row"
                onClick={() => setSelectedId(area.id)}
              >
                <span className="dot" style={{ background: area.colour }} />
                <span className="area-index__name">{area.name}</span>
                <span className="area-index__status">
                  {area.openTasks === 0 ? 'clear' : `${area.openTasks} open`}
                </span>
                <ChevronIcon />
              </button>
            </li>
          ))}
        </ul>

        {areas.length === 0 ? (
          <button type="button" className="area-index__empty" onClick={() => setSheet('create')}>
            <PlusIcon />
            <span>Create your first focus area</span>
          </button>
        ) : null}
      </div>

      {sheet === 'create' ? (
        <AreaForm usedColours={usedColours} onDone={() => setSheet(null)} />
      ) : null}
      {managing ? (
        <ManageAreas
          areas={areas}
          onDone={() => setManaging(false)}
          onNew={() => setSheet('create')}
          onEdit={(areaId) => {
            setSelectedId(areaId);
            setManaging(false);
            setSheet('edit');
          }}
        />
      ) : null}
    </>
  );
}

function ManageAreas({
  areas,
  onDone,
  onNew,
  onEdit,
}: {
  areas: Area[];
  onDone: () => void;
  onNew: () => void;
  onEdit: (areaId: string) => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [order, setOrder] = useState(areas.map((area) => area.id));
  const draggingId = useRef<string | null>(null);
  const [, start] = useTransition();
  const orderedAreas = order.flatMap((id) => {
    const area = areas.find((candidate) => candidate.id === id);
    return area ? [area] : [];
  });

  function archive(areaId: string) {
    setPendingId(areaId);
    start(async () => {
      await removeArea(areaId);
      setPendingId(null);
    });
  }

  function moveArea(source: string, target: string) {
    if (source === target) return;
    setOrder((current) => {
      const targetIndex = current.indexOf(target);
      const next = current.filter((id) => id !== source);
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, source);
      return next;
    });
  }

  return (
    <div className="manage-areas">
      <div className="manage-areas__header">
        <div>
          <h1 className="title">Manage areas</h1>
          <span className="subtitle">Drag to reorder · switch to archive</span>
        </div>
        <button type="button" onClick={onDone}>
          Done
        </button>
      </div>
      <div className="manage-areas__list">
        {orderedAreas.map((area) => (
          <div className="manage-area-row" data-area-id={area.id} key={area.id}>
            <button
              type="button"
              className="manage-area-row__drag"
              aria-label={`Drag ${area.name}`}
              onPointerDown={(event) => {
                draggingId.current = area.id;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const target = document
                  .elementFromPoint(event.clientX, event.clientY)
                  ?.closest<HTMLElement>('[data-area-id]')?.dataset['areaId'];
                if (target && draggingId.current) moveArea(draggingId.current, target);
              }}
              onPointerUp={() => {
                draggingId.current = null;
              }}
              onPointerCancel={() => {
                draggingId.current = null;
              }}
            >
              <DragIcon />
            </button>
            <span className="dot" style={{ background: area.colour }} />
            <button type="button" className="manage-area-row__body" onClick={() => onEdit(area.id)}>
              <strong>{area.name}</strong>
              <span>{area.openTasks === 0 ? 'nothing open' : `${area.openTasks} open tasks`}</span>
            </button>
            <button
              type="button"
              className="area-switch area-switch--on"
              disabled={pendingId === area.id}
              aria-label={`Archive ${area.name}`}
              onClick={() => archive(area.id)}
            >
              <span />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="manage-areas__new" onClick={onNew}>
        <PlusIcon size={16} />
        New focus area
      </button>
    </div>
  );
}

function AreaDetail({
  area,
  openTasks,
  doneTasks,
  onBack,
  onEdit,
}: {
  area: Area;
  openTasks: Task[];
  doneTasks: Task[];
  onBack: () => void;
  onEdit: () => void;
}) {
  const activity = useMemo(() => {
    const dates = Array.from({ length: 364 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (363 - index));
      return date.toLocaleDateString('en-CA');
    });
    const counts = new Map<string, number>();
    for (const task of doneTasks) {
      if (!task.completedAt) continue;
      const key = task.completedAt.toLocaleDateString('en-CA');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return dates.map((date) => counts.get(date) ?? 0);
  }, [doneTasks]);
  const max = Math.max(...activity, 1);
  let currentStreak = 0;
  for (let index = activity.length - 1; index >= 0 && (activity[index] ?? 0) > 0; index -= 1) {
    currentStreak += 1;
  }

  return (
    <>
      <div className="area-detail__nav">
        <button type="button" aria-label="Back to focus areas" onClick={onBack}>
          <BackIcon />
        </button>
        <button type="button" className="iconbtn" aria-label={`Edit ${area.name}`} onClick={onEdit}>
          <MoreIcon size={18} />
        </button>
      </div>
      <div className="screen area-detail">
        <div className="area-detail__title">
          <h1 className="title">{area.name}</h1>
          <div className="area-detail__badges">
            <span className="area-badge area-badge--active">
              <span className="dot dot--sm" style={{ background: area.colour }} /> Active
            </span>
            <span className="area-badge">{area.openTasks} open tasks</span>
          </div>
        </div>

        <div className="area-year" aria-label="Task completion history">
          {activity.map((value, index) => (
            <i
              key={index}
              style={{
                background:
                  value === 0
                    ? 'var(--line-1)'
                    : `color-mix(in srgb, ${area.colour} ${35 + Math.round((value / max) * 65)}%, #F2F1ED)`,
              }}
            />
          ))}
        </div>
        <div className="area-months">
          <span>SEP</span>
          <span>DEC</span>
          <span>MAR</span>
          <span>JUN</span>
          <span>SEP</span>
        </div>

        <div className="area-detail__stats">
          <AreaStat value={currentStreak} label="day streak" />
          <AreaStat value={doneTasks.length} label="tasks closed" />
          <AreaStat value={openTasks.length} label="tasks open" />
        </div>

        <section className="area-task-section">
          <div className="area-task-section__head">
            <strong>Open tasks</strong>
            <span>{openTasks.length}</span>
          </div>
          {openTasks.map((task) => (
            <div className="area-task" key={task.id}>
              <span className="task__box" aria-hidden />
              <div className="task__body">
                <span className="task__title">{task.title}</span>
                {task.dueAt ? (
                  <span className="task__meta">
                    due {task.dueAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                ) : null}
              </div>
              <span className="task__time">{formatEffort(task.effortMinutes)}</span>
            </div>
          ))}
          {openTasks.length === 0 ? (
            <p className="area-task-section__empty">Nothing open.</p>
          ) : null}
        </section>
      </div>
    </>
  );
}

function AreaStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function AreaForm({
  area,
  usedColours,
  onDelete,
  onDone,
}: {
  area?: Area;
  usedColours: string[];
  onDelete?: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(area?.name ?? '');
  const [colour, setColour] = useState(
    area?.colour ?? AREA_COLOURS.find((option) => !usedColours.includes(option)) ?? AREA_COLOURS[0],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const result = area ? await editArea(area.id, { name, colour }) : await addArea(name, colour);
      if (!result.ok) return setError(result.error);
      onDone();
    });
  }

  return (
    <div className="sheet-backdrop">
      <div className="area-sheet" role="dialog" aria-modal="true">
        <div className="sheet-handle" aria-hidden />
        <div className="sheet-heading">
          <span>{area ? 'Edit focus area' : 'New focus area'}</span>
          <button type="button" onClick={onDone}>
            Cancel
          </button>
        </div>
        <input
          className="area-sheet__name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Focus area name"
          autoFocus
        />
        <p className="area-sheet__hint">Ongoing, no end date. Tasks go inside it.</p>

        <span className="area-sheet__label">Colour</span>
        <div className="area-sheet__swatches">
          {AREA_COLOURS.filter(
            (option) => option === area?.colour || !usedColours.includes(option),
          ).map((option) => (
            <button
              type="button"
              key={option}
              className={`area-sheet__swatch${option === colour ? ' area-sheet__swatch--on' : ''}`}
              style={{ background: option, color: option }}
              aria-label={`Colour ${option}`}
              onClick={() => setColour(option)}
            />
          ))}
        </div>

        {error ? <p className="pair__error">{error}</p> : null}
        <button
          type="button"
          className="btn btn--primary area-sheet__save"
          disabled={pending || !name.trim() || usedColours.includes(colour)}
          onClick={save}
        >
          {pending ? 'Saving…' : area ? 'Save area' : 'Create area'}
        </button>
        {area && onDelete ? (
          <button type="button" className="area-sheet__delete" onClick={onDelete}>
            Archive or delete area
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DeleteAreaSheet({
  area,
  onDone,
  onCancel,
}: {
  area: Area;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState<'archive' | 'delete'>('archive');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirm() {
    setError(null);
    start(async () => {
      const result = choice === 'archive' ? await removeArea(area.id) : await deleteArea(area.id);
      if (!result.ok) return setError(result.error);
      onDone();
    });
  }

  return (
    <div className="sheet-backdrop">
      <div className="delete-area-sheet" role="dialog" aria-modal="true">
        <div className="sheet-handle" aria-hidden />
        <h2>Delete {area.name}?</h2>
        <p>
          {area.openTasks} open task{area.openTasks === 1 ? '' : 's'} belong to this area.
        </p>
        <button
          type="button"
          className={`delete-choice${choice === 'archive' ? ' delete-choice--on' : ''}`}
          onClick={() => setChoice('archive')}
        >
          <span className="delete-choice__radio" />
          <span>
            <strong>Archive it</strong>
            <small>Keeps its tasks and history.</small>
          </span>
        </button>
        <button
          type="button"
          className={`delete-choice${choice === 'delete' ? ' delete-choice--on' : ''}`}
          onClick={() => setChoice('delete')}
        >
          <span className="delete-choice__radio" />
          <span>
            <strong>Delete permanently</strong>
            <small>Tasks become unfiled. This cannot be undone.</small>
          </span>
        </button>
        {error ? <p className="pair__error">{error}</p> : null}
        <div className="delete-area-sheet__actions">
          <button type="button" className="btn btn--quiet" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={pending} onClick={confirm}>
            {pending ? 'Working…' : choice === 'archive' ? 'Archive area' : 'Delete area'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatEffort(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function BackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

function DragIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 9h16M4 15h16" />
    </svg>
  );
}
