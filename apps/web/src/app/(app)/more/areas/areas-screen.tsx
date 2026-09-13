'use client';

import { useState, useTransition } from 'react';
import { AREA_COLOURS } from '@/lib/area-colours';
import type { Area } from '@/lib/areas';
import { PlusIcon } from '@/components/icons';
import { Empty } from '@/components/empty';
import { addArea, deleteArea, editArea, removeArea } from './actions';

export function AreasScreen({ areas }: { areas: Area[] }) {
  const [adding, setAdding] = useState(false);
  const usedColours = areas.map((area) => area.colour);

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
        {adding ? <AreaForm usedColours={usedColours} onDone={() => setAdding(false)} /> : null}

        {areas.length === 0 && !adding ? (
          <Empty
            title="No focus areas"
            hint="Areas group related work, so your tasks stay easy to scan."
          />
        ) : (
          <ul className="arealist">
            {areas.map((area) => (
              <AreaRow
                key={area.id}
                area={area}
                usedColours={usedColours.filter((colour) => colour !== area.colour)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function AreaRow({ area, usedColours }: { area: Area; usedColours: string[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function archive() {
    setError(null);
    start(async () => {
      const result = await removeArea(area.id);
      if (!result.ok) setError(result.error);
    });
  }

  function deletePermanently() {
    if (!window.confirm(`Delete “${area.name}”? Its tasks will become unfiled.`)) return;
    setError(null);
    start(async () => {
      const result = await deleteArea(area.id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li className="arearow">
      <button className="arearow__head" onClick={() => setOpen((v) => !v)}>
        <span className="dot" style={{ background: area.colour }} />
        <span className="arearow__name">{area.name}</span>
        <span className="arearow__count">
          {area.openTasks === 0 ? 'nothing open' : `${area.openTasks} open`}
        </span>
      </button>

      {open ? (
        <div className="arearow__panel">
          <AreaForm area={area} usedColours={usedColours} onDone={() => setOpen(false)} />
          <button
            type="button"
            className="btn btn--quiet"
            disabled={pending}
            onClick={archive}
          >
            Archive this area
          </button>
          <button
            type="button"
            className="btn btn--quiet btn--danger"
            disabled={pending}
            onClick={deletePermanently}
          >
            Delete permanently
          </button>
          {error ? <p className="pair__error">{error}</p> : null}
          <p className="src__controlNote">
            Archiving keeps the area. Deleting it keeps its tasks as unfiled.
          </p>
        </div>
      ) : null}
    </li>
  );
}

function AreaForm({
  area,
  usedColours,
  onDone,
}: {
  area?: Area;
  usedColours: string[];
  onDone: () => void;
}) {
  const [name, setName] = useState(area?.name ?? '');
  const [colour, setColour] = useState<string>(
    area?.colour ?? AREA_COLOURS.find((option) => !usedColours.includes(option)) ?? AREA_COLOURS[0],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const result = area
        ? await editArea(area.id, { name, colour })
        : await addArea(name, colour);
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
        {AREA_COLOURS.filter((colourOption) => !usedColours.includes(colourOption)).map((c) => (
          <button
            type="button"
            key={c}
            className={`swatch${c === colour ? ' swatch--on' : ''}`}
            style={{ background: c }}
            aria-label={`Colour ${c}`}
            aria-pressed={c === colour}
            onClick={() => setColour(c)}
          />
        ))}
      </div>
      {!area && usedColours.length >= AREA_COLOURS.length ? (
        <p className="formhint">Archive an area to free a colour before adding another.</p>
      ) : null}

      {error ? <p className="pair__error">{error}</p> : null}

      <div className="areaform__actions">
        <button type="button" className="btn btn--quiet" disabled={pending} onClick={onDone}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={pending || !name.trim() || usedColours.includes(colour)}
          onClick={save}
        >
          {pending ? 'Saving…' : area ? 'Save' : 'Add area'}
        </button>
      </div>
    </div>
  );
}
