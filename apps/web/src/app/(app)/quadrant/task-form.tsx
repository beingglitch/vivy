'use client';

import { useState, useTransition } from 'react';
import type { Area } from '@/lib/areas';
import {
  DEADLINE_KINDS,
  DUE_PERIODS,
  EFFORTS,
  IMPORTANCE,
  RADII,
  addPeriodTo,
} from '@/lib/task-scales';
import { addTask } from './actions';

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
  onDone,
}: {
  areas: Area[];
  importance: number;
  effortMinutes: number;
  onDone: () => void;
}) {
  const [title, setTitle] = useState('');
  const [areaId, setAreaId] = useState<string | null>(areas[0]?.id ?? null);
  const [importance, setImportance] = useState(initialImportance);
  const [effort, setEffort] = useState(initialEffort);

  const [kind, setKind] = useState<string>('none');
  const [byPeriod, setByPeriod] = useState(true);
  const [date, setDate] = useState('');
  const [period, setPeriod] = useState<{ amount: number; unit: string } | null>(null);

  const [place, setPlace] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(250);
  const [locating, setLocating] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /** The instant the deadline lands on, whichever way it was entered. */
  function resolveDue(): Date | null {
    if (kind === 'none') return null;
    if (byPeriod) {
      if (!period) return null;
      return addPeriodTo(new Date(), period.amount, period.unit);
    }
    if (!date) return null;
    // End of the chosen day, not midnight at its start: "due Friday" means
    // Friday is still fine, and midnight would make it already late.
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function useMyLocation() {
    setError(null);
    if (!('geolocation' in navigator)) {
      setError('This browser cannot read a location.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlace({
          label: 'Here',
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setLocating(false);
      },
      () => {
        setError('Could not get a location. Allow location access and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const due = resolveDue();

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
      ) : null}

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

      <span className="field__label">Deadline</span>
      <div className="chips">
        {DEADLINE_KINDS.map((k) => (
          <button
            key={k.value}
            className={`chip${k.value === kind ? ' chip--on' : ''}`}
            onClick={() => setKind(k.value)}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="formhint">{DEADLINE_KINDS.find((k) => k.value === kind)?.hint}</p>

      {kind !== 'none' ? (
        <>
          <div className="chips">
            <button
              className={`chip${byPeriod ? ' chip--on' : ''}`}
              onClick={() => setByPeriod(true)}
            >
              In a while
            </button>
            <button
              className={`chip${!byPeriod ? ' chip--on' : ''}`}
              onClick={() => setByPeriod(false)}
            >
              On a date
            </button>
          </div>

          {byPeriod ? (
            <div className="chips">
              {DUE_PERIODS.map((p) => (
                <button
                  key={p.label}
                  className={`chip${
                    period?.amount === p.amount && period?.unit === p.unit ? ' chip--on' : ''
                  }`}
                  onClick={() => setPeriod({ amount: p.amount, unit: p.unit })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="date"
              className="field__input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )}

          {due ? (
            <p className="formhint">
              Due {due.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              {kind === 'expires' ? '. After that it drops off the board.' : '. After that it falls behind.'}
            </p>
          ) : null}
        </>
      ) : null}

      <span className="field__label">Place</span>
      {place ? (
        <>
          <div className="chips">
            <button className="chip chip--on" onClick={() => setPlace(null)}>
              {place.label} · {place.lat.toFixed(4)}, {place.lng.toFixed(4)} ✕
            </button>
          </div>
          <span className="field__label">Alert within</span>
          <div className="chips">
            {RADII.map((r) => (
              <button
                key={r.value}
                className={`chip${r.value === radius ? ' chip--on' : ''}`}
                onClick={() => setRadius(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="formhint">
            Saved with the task. The alert itself needs the Android app, which is the only part
            that can watch for you arriving while the phone is in your pocket.
          </p>
        </>
      ) : (
        <div className="chips">
          <button className="chip" disabled={locating} onClick={useMyLocation}>
            {locating ? 'Finding you…' : 'Use my location'}
          </button>
          <button className="chip chip--on" onClick={() => setPlace(null)}>
            Anywhere
          </button>
        </div>
      )}

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
                deadlineKind: kind,
                dueAt: due ? due.toISOString() : null,
                dueAmount: byPeriod ? (period?.amount ?? null) : null,
                dueUnit: byPeriod ? (period?.unit ?? null) : null,
                placeLabel: place?.label ?? null,
                lat: place?.lat ?? null,
                lng: place?.lng ?? null,
                radiusM: place ? radius : null,
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
