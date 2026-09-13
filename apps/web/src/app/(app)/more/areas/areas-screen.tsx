'use client';

import { useState, useTransition } from 'react';
import { AREA_COLOURS } from '@/lib/area-colours';
import type { Area } from '@/lib/areas';
import { PlusIcon } from '@/components/icons';
import { Empty } from '@/components/empty';
import { addArea, editArea, removeArea } from './actions';

/** Common rhythms, so the usual case is one tap rather than typing a number. */
const CADENCES = [
  { value: null, label: 'No cadence' },
  { value: 1, label: 'Daily' },
  { value: 3, label: 'Every 3 days' },
  { value: 7, label: 'Weekly' },
  { value: 14, label: 'Fortnightly' },
  { value: 30, label: 'Monthly' },
] as const;

export function AreasScreen({ areas }: { areas: Area[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Focus areas</h1>
            <span className="subtitle">
              {areas.length === 0
                ? 'None yet'
                : `${areas.length} area${areas.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <button
            className="iconbtn"
            aria-label={adding ? 'Cancel' : 'New area'}
            onClick={() => setAdding((v) => !v)}
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="screen">
        {adding ? <AreaForm onDone={() => setAdding(false)} /> : null}

        {areas.length === 0 && !adding ? (
          <Empty
            title="No focus areas"
            hint="Areas group your work and give each one a cadence, so Vivy can tell when something has gone cold."
          />
        ) : (
          <ul className="arealist">
            {areas.map((area) => (
              <AreaRow key={area.id} area={area} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function AreaRow({ area }: { area: Area }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <li className="arearow">
      <button className="arearow__head" onClick={() => setOpen((v) => !v)}>
        <span className="dot" style={{ background: area.colour }} />
        <span className="arearow__name">{area.name}</span>
        {area.cold ? <span className="arearow__cold">cold</span> : null}
        <span className="arearow__count">
          {area.openTasks === 0 ? 'nothing open' : `${area.openTasks} open`}
        </span>
      </button>

      <p className="arearow__meta">
        {area.cadenceDays === null
          ? 'No cadence set'
          : `Every ${area.cadenceDays} day${area.cadenceDays === 1 ? '' : 's'}`}
        {area.lastDoneDaysAgo === null
          ? ' · nothing finished yet'
          : area.lastDoneDaysAgo === 0
            ? ' · last finished today'
            : ` · last finished ${area.lastDoneDaysAgo}d ago`}
      </p>

      {open ? (
        <div className="arearow__panel">
          <AreaForm area={area} onDone={() => setOpen(false)} />
          <button
            className="btn btn--quiet"
            disabled={pending}
            onClick={() => start(() => void removeArea(area.id))}
          >
            Archive this area
          </button>
          <p className="src__controlNote">
            Archiving hides it. Tasks filed here keep their colour and name.
          </p>
        </div>
      ) : null}
    </li>
  );
}

function AreaForm({ area, onDone }: { area?: Area; onDone: () => void }) {
  const [name, setName] = useState(area?.name ?? '');
  const [colour, setColour] = useState<string>(area?.colour ?? AREA_COLOURS[0]);
  const [cadence, setCadence] = useState<number | null>(area?.cadenceDays ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const result = area
        ? await editArea(area.id, { name, colour, cadenceDays: cadence })
        : await addArea(name, colour, cadence);
      if (!result.ok) return setError(result.error);
      onDone();
    });
  }

  return (
    <div className="areaform">
      <div className="field">
        <label className="field__label" htmlFor={`n-${area?.id ?? 'new'}`}>
          Name
        </label>
        <input
          id={`n-${area?.id ?? 'new'}`}
          className="field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Health, Money, Learning…"
          autoComplete="off"
        />
      </div>

      <span className="field__label">Colour</span>
      <div className="swatches">
        {AREA_COLOURS.map((c) => (
          <button
            key={c}
            className={`swatch${c === colour ? ' swatch--on' : ''}`}
            style={{ background: c }}
            aria-label={`Colour ${c}`}
            aria-pressed={c === colour}
            onClick={() => setColour(c)}
          />
        ))}
      </div>

      <span className="field__label">Cadence</span>
      <div className="chips">
        {CADENCES.map((c) => (
          <button
            key={String(c.value)}
            className={`chip${c.value === cadence ? ' chip--on' : ''}`}
            onClick={() => setCadence(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error ? <p className="pair__error">{error}</p> : null}

      <div className="areaform__actions">
        <button className="btn btn--primary" disabled={pending || !name.trim()} onClick={save}>
          {pending ? 'Saving…' : area ? 'Save' : 'Add area'}
        </button>
        <button className="btn btn--quiet" disabled={pending} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
