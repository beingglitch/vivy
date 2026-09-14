'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { PlusIcon } from '@/components/icons';
import { AREA_COLOURS } from '@/lib/area-colours';
import type { Area } from '@/lib/areas';
import type { Task } from '@/lib/tasks';
import { addArea, deleteArea, editArea, removeArea, reorderAreaList, resumeArea } from './actions';

type Sheet = 'create' | 'edit' | 'delete' | null;

export function AreasScreen({
  areas,
  allAreas,
  doneTasks,
}: {
  areas: Area[];
  allAreas: Area[];
  doneTasks: Task[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const selected = allAreas.find((area) => area.id === selectedId) ?? null;
  const usedColours = areas.map((area) => area.colour);

  return (
    <>
      <ManageAreas
        areas={allAreas}
        doneTasks={doneTasks}
        onNew={() => setSheet('create')}
        onEdit={(areaId) => {
          setSelectedId(areaId);
          setSheet('edit');
        }}
        onDelete={(areaId) => {
          setSelectedId(areaId);
          setSheet('delete');
        }}
      />

      {sheet === 'create' ? (
        <AreaForm usedColours={usedColours} onDone={() => setSheet(null)} />
      ) : null}
      {sheet === 'edit' && selected ? (
        <AreaForm
          area={selected}
          usedColours={usedColours.filter((colour) => colour !== selected.colour)}
          onDelete={() => setSheet('delete')}
          onDone={() => {
            setSheet(null);
            setSelectedId(null);
          }}
        />
      ) : null}
      {sheet === 'delete' && selected ? (
        <DeleteAreaSheet
          area={selected}
          doneTasks={doneTasks.filter((task) => task.areaId === selected.id).length}
          targetAreas={areas.filter((area) => area.id !== selected.id)}
          onDone={() => {
            setSheet(null);
            setSelectedId(null);
          }}
          onCancel={() => {
            setSheet(null);
            setSelectedId(null);
          }}
        />
      ) : null}
    </>
  );
}

function ManageAreas({
  areas,
  doneTasks,
  onNew,
  onEdit,
  onDelete,
}: {
  areas: Area[];
  doneTasks: Task[];
  onNew: () => void;
  onEdit: (areaId: string) => void;
  onDelete: (areaId: string) => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [swipePreview, setSwipePreview] = useState<{ areaId: string; offset: number } | null>(null);
  const [order, setOrder] = useState(areas.map((area) => area.id));
  const orderRef = useRef(order);
  const draggingId = useRef<string | null>(null);
  const swiping = useRef<{ areaId: string; x: number; y: number; wasRevealed: boolean } | null>(
    null,
  );
  const [, start] = useTransition();

  useEffect(() => {
    setOrder((current) => {
      const areaIds = areas.map((area) => area.id);
      const next = [...current.filter((id) => areaIds.includes(id))];
      for (const areaId of areaIds) {
        if (!next.includes(areaId)) next.push(areaId);
      }
      orderRef.current = next;
      return next;
    });
  }, [areas]);

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

  function resume(areaId: string) {
    setPendingId(areaId);
    start(async () => {
      await resumeArea(areaId);
      setPendingId(null);
    });
  }

  function moveArea(source: string, target: string) {
    if (source === target) return;
    setOrder((current) => {
      const targetIndex = current.indexOf(target);
      const next = current.filter((id) => id !== source);
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, source);
      orderRef.current = next;
      return next;
    });
  }

  function saveOrder() {
    start(async () => {
      await reorderAreaList(orderRef.current);
    });
  }

  const activeAreas = orderedAreas.filter((area) => area.archivedAt === null);
  const pausedAreas = orderedAreas.filter((area) => area.archivedAt !== null);

  function areaRow(area: Area) {
    const paused = area.archivedAt !== null;
    const revealed = revealedId === area.id;
    const activity = areaActivity(area, doneTasks);
    return (
      <div className="manage-area-swipe" data-area-id={area.id} key={area.id}>
        <div className="manage-area-swipe__actions" aria-hidden={!revealed}>
          <button
            type="button"
            tabIndex={revealed ? 0 : -1}
            onClick={() => (paused ? resume(area.id) : archive(area.id))}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </button>
          <button
            type="button"
            className="manage-area-swipe__delete"
            tabIndex={revealed ? 0 : -1}
            onClick={() => onDelete(area.id)}
          >
            <TrashIcon />
            <span>Delete</span>
          </button>
        </div>
        <div
          className={`manage-area-row${paused ? ' manage-area-row--paused' : ''}${
            revealed ? ' manage-area-row--revealed' : ''
          }`}
          style={
            swipePreview?.areaId === area.id
              ? { transform: `translateX(${swipePreview.offset}px)`, transition: 'none' }
              : undefined
          }
        >
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
              saveOrder();
            }}
            onPointerCancel={() => {
              draggingId.current = null;
            }}
          >
            <DragIcon />
          </button>
          <span
            className="dot"
            style={{
              background: paused || activity.cold ? 'var(--line-6)' : area.colour,
            }}
          />
          <button
            type="button"
            className="manage-area-row__body"
            onPointerDown={(event) => {
              if (revealedId && revealedId !== area.id) setRevealedId(null);
              swiping.current = {
                areaId: area.id,
                x: event.clientX,
                y: event.clientY,
                wasRevealed: revealed,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const gesture = swiping.current;
              if (!gesture || gesture.areaId !== area.id) return;
              const distanceX = event.clientX - gesture.x;
              const distanceY = event.clientY - gesture.y;
              if (Math.abs(distanceY) > Math.abs(distanceX) && Math.abs(distanceY) > 10) {
                setSwipePreview(null);
                return;
              }
              const start = gesture.wasRevealed ? -156 : 0;
              const offset = Math.max(-156, Math.min(0, start + distanceX));
              setSwipePreview({ areaId: area.id, offset });
            }}
            onPointerUp={(event) => {
              const gesture = swiping.current;
              swiping.current = null;
              setSwipePreview(null);
              if (!gesture || gesture.areaId !== area.id) return;
              const distanceX = event.clientX - gesture.x;
              const distanceY = event.clientY - gesture.y;
              if (Math.abs(distanceY) > Math.abs(distanceX) && Math.abs(distanceY) > 10) return;
              const finalOffset = (gesture.wasRevealed ? -156 : 0) + distanceX;
              if (Math.abs(distanceX) > 8) {
                setRevealedId(finalOffset <= -48 ? area.id : null);
                return;
              }
              if (revealed) return setRevealedId(null);
              onEdit(area.id);
            }}
            onPointerCancel={() => {
              swiping.current = null;
              setSwipePreview(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onEdit(area.id);
              }
            }}
          >
            <strong>{area.name}</strong>
            <span>
              {paused
                ? `paused ${area.archivedAt?.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })} · ${area.totalTasks} tasks kept`
                : `${cadenceLabel(area.cadenceDays)} · ${activity.label}`}
            </span>
          </button>
          <button
            type="button"
            className={`area-switch${paused ? '' : ' area-switch--on'}`}
            disabled={pendingId === area.id}
            aria-label={`${paused ? 'Resume' : 'Pause'} ${area.name}`}
            onClick={() => (paused ? resume(area.id) : archive(area.id))}
          >
            <span />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="manage-areas">
      <div className="manage-areas__header">
        <div>
          <h1 className="title">Focus areas</h1>
          <span className="subtitle">Drag to reorder · swipe left for actions</span>
        </div>
      </div>
      <div className="manage-areas__list">
        {activeAreas.map(areaRow)}
        {pausedAreas.length > 0 ? (
          <div className="manage-areas__paused-label">
            <span>Paused</span>
            <span>{pausedAreas.length}</span>
          </div>
        ) : null}
        {pausedAreas.map(areaRow)}
      </div>
      <button type="button" className="manage-areas__new" onClick={onNew}>
        <PlusIcon size={16} />
        New focus area
      </button>
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
  const [cadenceDays, setCadenceDays] = useState(area?.cadenceDays ?? 7);
  const [showOnHome, setShowOnHome] = useState(area?.showOnHome ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const result = area
        ? await editArea(area.id, { name, colour, cadenceDays, showOnHome })
        : await addArea(name, colour, cadenceDays, showOnHome);
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

        <span className="area-sheet__label">Cadence</span>
        <div className="area-sheet__options">
          {[
            { value: 1, label: 'Daily' },
            { value: 7, label: 'Weekly' },
            { value: 30, label: 'Monthly' },
          ].map((option) => (
            <button
              type="button"
              key={option.value}
              className={option.value === cadenceDays ? 'area-sheet__option--on' : ''}
              onClick={() => setCadenceDays(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="area-sheet__hint">
          {cadenceDays === 1
            ? 'Goes cold after two missed days.'
            : cadenceDays === 7
              ? 'Goes cold after two missed weeks.'
              : 'Goes cold after two missed months.'}
        </p>

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

        <div className="area-sheet__home">
          <span>
            <strong>Show on Home</strong>
            <small>Adds a heatmap row for this area</small>
          </span>
          <button
            type="button"
            className={`area-switch${showOnHome ? ' area-switch--on' : ''}`}
            aria-label={`${showOnHome ? 'Hide from' : 'Show on'} Home`}
            onClick={() => setShowOnHome((current) => !current)}
          >
            <span />
          </button>
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
            Delete focus area
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DeleteAreaSheet({
  area,
  doneTasks,
  targetAreas,
  onDone,
  onCancel,
}: {
  area: Area;
  doneTasks: number;
  targetAreas: Area[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [targetAreaId, setTargetAreaId] = useState<string | null>(targetAreas[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirm() {
    setError(null);
    start(async () => {
      const result = await deleteArea(area.id, targetAreaId);
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
          {area.openTasks} open and {doneTasks} closed task{doneTasks === 1 ? '' : 's'} belong to
          this area. Deleting it removes its history permanently and cannot be undone.
        </p>
        {area.openTasks > 0 ? (
          <div className="delete-area-sheet__move">
            <span>
              <strong>
                Move {area.openTasks} open task{area.openTasks === 1 ? '' : 's'} to
              </strong>
              <small>They keep their quadrant position</small>
            </span>
            <select
              value={targetAreaId ?? ''}
              onChange={(event) => setTargetAreaId(event.target.value || null)}
              aria-label="Move open tasks to"
            >
              <option value="">Unfiled</option>
              {targetAreas.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {error ? <p className="pair__error">{error}</p> : null}
        <div className="delete-area-sheet__actions">
          <button type="button" className="btn btn--quiet" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn delete-area-sheet__confirm"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

function cadenceLabel(days: number | null) {
  if (days === 1) return 'daily';
  if (days === 7) return 'weekly';
  if (days === 30) return 'monthly';
  return 'ongoing';
}

function areaActivity(area: Area, doneTasks: Task[]) {
  const completions = doneTasks
    .filter((task) => task.areaId === area.id && task.completedAt)
    .map((task) => task.completedAt!)
    .sort((left, right) => right.getTime() - left.getTime());
  const latest = completions[0];
  if (!latest) {
    return {
      cold: false,
      label:
        area.openTasks === 0
          ? 'nothing open'
          : `${area.openTasks} open task${area.openTasks === 1 ? '' : 's'}`,
    };
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const latestDay = new Date(latest);
  latestDay.setHours(12, 0, 0, 0);
  const daysAgo = Math.max(0, Math.round((today.getTime() - latestDay.getTime()) / 86_400_000));
  const cadenceDays = area.cadenceDays ?? 7;
  if (daysAgo === 0) return { cold: false, label: 'touched today' };
  if (daysAgo > cadenceDays * 2) return { cold: true, label: `cold ${daysAgo} days` };
  return { cold: false, label: `touched ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago` };
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

function PauseIcon() {
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
      <path d="M9 5v14M15 5v14" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="m8 5 11 7-11 7z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 7h14M9 7V5h6v2M6.5 7l1 12h9l1-12" />
    </svg>
  );
}
