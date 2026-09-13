'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { Area } from '@/lib/areas';
import type { Task } from '@/lib/tasks';
import {
  DEADLINE_KINDS,
  IMPORTANCE,
  MAX_EFFORT_MINUTES,
  MIN_EFFORT_MINUTES,
  addPeriodTo,
  type DeadlineKind,
} from '@/lib/task-scales';
import { addTask, editTask } from './actions';
import { LocationPicker, type PickedPlace } from './location-picker';

type DeadlineOption = (typeof DEADLINE_KINDS)[number];
type DueMode = 'tomorrow' | 'date' | 'relative';

const DEADLINE_ORDER_KEY = 'vivy.deadline-order';

function loadDeadlineOrder(): DeadlineOption[] {
  if (typeof window === 'undefined') return [...DEADLINE_KINDS];
  try {
    const saved = JSON.parse(window.localStorage.getItem(DEADLINE_ORDER_KEY) ?? '[]') as string[];
    const ordered = saved
      .filter((value, index) => saved.indexOf(value) === index)
      .flatMap((value) => {
        const option = DEADLINE_KINDS.find((candidate) => candidate.value === value);
        return option ? [option] : [];
      });
    return [
      ...ordered,
      ...DEADLINE_KINDS.filter(
        (option) => !ordered.some((candidate) => candidate.value === option.value),
      ),
    ];
  } catch {
    return [...DEADLINE_KINDS];
  }
}

function formatEffort(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}

function effortProgress(minutes: number): number {
  return (
    ((Math.log(minutes) - Math.log(MIN_EFFORT_MINUTES)) /
      (Math.log(MAX_EFFORT_MINUTES) - Math.log(MIN_EFFORT_MINUTES))) *
    100
  );
}

function effortFromProgress(progress: number): number {
  const minutes =
    MIN_EFFORT_MINUTES *
    Math.exp((progress / 100) * (Math.log(MAX_EFFORT_MINUTES) - Math.log(MIN_EFFORT_MINUTES)));
  return Math.min(MAX_EFFORT_MINUTES, Math.max(MIN_EFFORT_MINUTES, Math.round(minutes / 5) * 5));
}

/**
 * Create a task, opened by tapping the spot on the grid where it belongs.
 *
 * Importance and effort arrive already chosen, because the tap said both. They
 * are still shown and still editable: a tap is a rough aim, and being unable to
 * correct it would make the gesture a trap rather than a shortcut.
 */
export function TaskForm({
  areas,
  importance: initialImportance,
  effortMinutes: initialEffort,
  task,
  onDone,
}: {
  areas: Area[];
  importance: number;
  effortMinutes: number;
  task?: Task;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [areaId, setAreaId] = useState<string | null>(task?.areaId ?? areas[0]?.id ?? null);
  const [importance, setImportance] = useState(task?.importance ?? initialImportance);
  const [effort, setEffort] = useState(task?.effortMinutes ?? initialEffort);

  const [deadlineOptions, setDeadlineOptions] = useState<DeadlineOption[]>([...DEADLINE_KINDS]);
  const [kind, setKind] = useState<DeadlineKind>(
    task && DEADLINE_KINDS.some((option) => option.value === task.deadlineKind)
      ? (task.deadlineKind as DeadlineKind)
      : 'none',
  );
  const [dueMode, setDueMode] = useState<DueMode>(task?.dueAmount ? 'relative' : 'date');
  const [date, setDate] = useState(task?.dueAt ? task.dueAt.toISOString().slice(0, 10) : '');
  const [relativeAmount, setRelativeAmount] = useState(task?.dueAmount ?? 1);
  const [relativeUnit, setRelativeUnit] = useState(task?.dueUnit ?? 'week');

  const [place, setPlace] = useState<PickedPlace | null>(
    task?.lat != null && task.lng != null
      ? { label: task.placeLabel ?? 'Pinned location', lat: task.lat, lng: task.lng }
      : null,
  );
  const [radius, setRadius] = useState(task?.radiusM ?? 250);
  const [choosingPlace, setChoosingPlace] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const hold = useRef<{
    timer: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const options = loadDeadlineOrder();
    setDeadlineOptions(options);
    if (!task) setKind(options[0]?.value ?? 'none');
  }, []);

  /** The instant the deadline lands on, whichever way it was entered. */
  function resolveDue(): Date | null {
    if (kind === 'none') return null;
    if (dueMode === 'tomorrow') return addPeriodTo(new Date(), 1, 'day');
    if (dueMode === 'relative') return addPeriodTo(new Date(), relativeAmount, relativeUnit);
    if (!date) return null;
    // End of the chosen day, not midnight at its start: "due Friday" means
    // Friday is still fine, and midnight would make it already late.
    return new Date(`${date}T23:59:59.999`);
  }

  function makeDeadlineDefault(value: DeadlineKind) {
    const reordered = [
      ...deadlineOptions.filter((option) => option.value === value),
      ...deadlineOptions.filter((option) => option.value !== value),
    ];
    setDeadlineOptions(reordered);
    setKind(value);
    try {
      window.localStorage.setItem(
        DEADLINE_ORDER_KEY,
        JSON.stringify(reordered.map((option) => option.value)),
      );
    } catch {}
    navigator.vibrate?.(30);
  }

  function startDeadlineHold(event: React.PointerEvent, value: DeadlineKind) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stopDeadlineHold();
    hold.current = {
      x: event.clientX,
      y: event.clientY,
      timer: setTimeout(() => makeDeadlineDefault(value), 550),
    };
  }

  function moveDeadlineHold(event: React.PointerEvent) {
    if (!hold.current) return;
    if (Math.hypot(event.clientX - hold.current.x, event.clientY - hold.current.y) > 8) {
      stopDeadlineHold();
    }
  }

  function stopDeadlineHold() {
    if (!hold.current) return;
    clearTimeout(hold.current.timer);
    hold.current = null;
  }

  const due = resolveDue();
  const relative = dueMode === 'relative';
  const dueAmount =
    kind === 'none' || dueMode === 'date' ? null : dueMode === 'tomorrow' ? 1 : relativeAmount;
  const dueUnit =
    kind === 'none' || dueMode === 'date' ? null : dueMode === 'tomorrow' ? 'day' : relativeUnit;

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
          autoFocus
        />
      </div>

      {areas.length > 0 ? (
        <>
          <span className="field__label">Area</span>
          <div className="chips">
            {areas.map((a) => (
              <button
                type="button"
                key={a.id}
                className={`chip${a.id === areaId ? ' chip--on' : ''}`}
                onClick={() => setAreaId(a.id)}
              >
                {a.name}
              </button>
            ))}
            <button
              type="button"
              className={`chip${areaId === null ? ' chip--on' : ''}`}
              onClick={() => setAreaId(null)}
            >
              Unfiled
            </button>
          </div>
        </>
      ) : null}

      <div className="task-scale">
        <div className="task-scale__head">
          <span className="field__label">Y · Importance</span>
          <strong>{IMPORTANCE.find((option) => option.value === importance)?.label}</strong>
        </div>
        <input
          className="task-scale__range"
          type="range"
          min={1}
          max={4}
          step={1}
          value={importance}
          onChange={(event) => setImportance(Number(event.target.value))}
          aria-label="Y importance"
        />
        <div className="task-scale__ends">
          <span>Low</span>
          <span>Critical</span>
        </div>
      </div>

      <div className="task-scale">
        <div className="task-scale__head">
          <span className="field__label">X · Time to finish</span>
          <strong>{formatEffort(effort)}</strong>
        </div>
        <input
          className="task-scale__range"
          type="range"
          min={0}
          max={100}
          step={1}
          value={effortProgress(effort)}
          onChange={(event) => setEffort(effortFromProgress(Number(event.target.value)))}
          aria-label="X time to finish"
        />
        <div className="task-scale__ends">
          <span>5 min</span>
          <span>24 h</span>
        </div>
      </div>

      <span className="field__label">Deadline</span>
      <div className="chips">
        {deadlineOptions.map((option, index) => (
          <button
            type="button"
            key={option.value}
            className={`chip${option.value === kind ? ' chip--on' : ''}`}
            onClick={() => setKind(option.value)}
            onPointerDown={(event) => startDeadlineHold(event, option.value)}
            onPointerMove={moveDeadlineHold}
            onPointerUp={stopDeadlineHold}
            onPointerCancel={stopDeadlineHold}
            onContextMenu={(event) => event.preventDefault()}
          >
            {option.label}
            {index === 0 ? ' · default' : ''}
          </button>
        ))}
      </div>
      <p className="formhint">{DEADLINE_KINDS.find((k) => k.value === kind)?.hint}</p>
      <p className="formhint">
        Press and hold a deadline type to move it first and make it default.
      </p>

      {kind !== 'none' ? (
        <>
          <div className="chips">
            <button
              type="button"
              className={`chip${dueMode === 'tomorrow' ? ' chip--on' : ''}`}
              onClick={() => setDueMode('tomorrow')}
            >
              Tomorrow
            </button>
            <button
              type="button"
              className={`chip${dueMode === 'date' ? ' chip--on' : ''}`}
              onClick={() => setDueMode('date')}
            >
              On a date
            </button>
            <button
              type="button"
              className={`chip${relative ? ' chip--on' : ''}`}
              onClick={() => setDueMode('relative')}
            >
              In…
            </button>
          </div>

          {relative ? (
            <div className="relative-due">
              <input
                className="field__input relative-due__amount"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={relativeAmount}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setRelativeAmount(Number.isFinite(value) ? Math.min(365, Math.max(1, value)) : 1);
                }}
                aria-label="Deadline amount"
              />
              <div className="chips">
                {['day', 'week', 'month'].map((unit) => (
                  <button
                    type="button"
                    key={unit}
                    className={`chip${relativeUnit === unit ? ' chip--on' : ''}`}
                    onClick={() => setRelativeUnit(unit)}
                  >
                    {unit}
                    {relativeAmount === 1 ? '' : 's'}
                  </button>
                ))}
              </div>
            </div>
          ) : dueMode === 'date' ? (
            <input
              type="date"
              className="field__input"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          ) : null}

          {due ? (
            <p className="formhint">
              Due{' '}
              {due.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              {kind === 'expires'
                ? '. After that it drops off the board.'
                : '. After that it falls behind.'}
            </p>
          ) : null}
        </>
      ) : null}

      <span className="field__label">Place</span>
      <div className="chips">
        <button
          type="button"
          className={`chip${place ? ' chip--on' : ''}`}
          onClick={() => setChoosingPlace(true)}
        >
          {place ? 'Change place on map' : 'Use my location'}
        </button>
        <button
          type="button"
          className={`chip${place === null ? ' chip--on' : ''}`}
          onClick={() => setPlace(null)}
        >
          Anywhere
        </button>
      </div>

      {place ? (
        <p className="formhint">
          {place.label} · {place.lat.toFixed(6)}, {place.lng.toFixed(6)} · radius {radius} m
        </p>
      ) : null}

      {choosingPlace ? (
        <LocationPicker
          value={place}
          radius={radius}
          onClose={() => setChoosingPlace(false)}
          onChoose={(nextPlace, nextRadius) => {
            setPlace(nextPlace);
            setRadius(nextRadius);
            setChoosingPlace(false);
          }}
        />
      ) : null}

      {error ? <p className="pair__error">{error}</p> : null}

      <div className="areaform__actions">
        <button type="button" className="btn btn--quiet" disabled={pending} onClick={onDone}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={pending || !title.trim() || (kind !== 'none' && !due)}
          onClick={() => {
            setError(null);
            start(async () => {
              const input = {
                title,
                areaId,
                importance,
                effortMinutes: effort,
                deadlineKind: kind,
                dueAt: due ? due.toISOString() : null,
                dueAmount,
                dueUnit,
                placeLabel: place?.label ?? null,
                lat: place?.lat ?? null,
                lng: place?.lng ?? null,
                radiusM: place ? radius : null,
              };
              const result = task ? await editTask(task.id, input) : await addTask(input);
              if (!result.ok) return setError(result.error);
              onDone();
            });
          }}
        >
          {pending ? 'Saving…' : task ? 'Save task' : 'Add task'}
        </button>
      </div>
    </div>
  );
}
