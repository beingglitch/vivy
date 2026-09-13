'use client';

import { useState } from 'react';
import { ChevronIcon } from '@/components/icons';
import type { StreamRow } from '@/lib/streams-data';

/**
 * The four densities Home draws: year grid, 30-day strip, curve, bars.
 *
 * Kept even though nothing fills it yet, because the rendering is the designed
 * part and `values: number[]` is exactly what the rollup produces. Colour is
 * derived here rather than stored, so a stream's ramp can change without
 * rewriting history.
 */

const DENSITIES = ['Year grid', '30 days', 'Curve', 'Bars'] as const;
type Density = (typeof DENSITIES)[number];
const STORE_KEY = 'vivy.density';

/** Five steps of one hue: empty, then four intensities. */
function shade(base: string, value: number, max: number): string {
  if (value <= 0 || max <= 0) return 'var(--line-1)';
  const step = Math.min(3, Math.floor((value / max) * 4));
  const pct = [22, 45, 72, 100][step] ?? 100;
  return pct === 100 ? base : `color-mix(in srgb, ${base} ${pct}%, #F2F1ED)`;
}

function format(value: number, unit: string): string {
  if (unit === 'seconds') {
    const mins = Math.round(value / 60);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  }
  if (unit === 'minor-currency') return `₹${Math.round(value / 100).toLocaleString('en-IN')}`;
  return String(Math.round(value));
}

export function StreamsScreen({ streams }: { streams: StreamRow[] }) {
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === 'undefined') return 'Year grid';
    const saved = window.localStorage.getItem(STORE_KEY);
    return (DENSITIES as readonly string[]).includes(saved ?? '') ? (saved as Density) : 'Year grid';
  });

  function choose(next: Density) {
    setDensity(next);
    try {
      window.localStorage.setItem(STORE_KEY, next);
    } catch {
      // Private mode, or storage disabled. The choice just will not persist.
    }
  }

  return (
    <>
      <div className="chips" role="tablist" aria-label="Density" style={{ padding: '0 20px 12px' }}>
        {DENSITIES.map((d) => (
          <button
            key={d}
            role="tab"
            className="chip"
            aria-selected={density === d}
            onClick={() => choose(d)}
          >
            {d}
          </button>
        ))}
      </div>

      {streams
        .filter((s) => s.values.length > 0)
        .map((s) => (
          <Row key={s.key} stream={s} density={density} />
        ))}
    </>
  );
}

function Row({ stream, density }: { stream: StreamRow; density: Density }) {
  const max = Math.max(...stream.values, 0);
  const last30 = stream.values.slice(-30);
  const compact = density === '30 days';

  return (
    <div className={`streamrow${compact ? ' streamrow--compact' : ''}`}>
      <div className="streamrow__top">
        <span className="dot" style={{ background: stream.dot }} />
        <span className="streamrow__name">{stream.name}</span>
        <div style={{ flex: 1 }} />
        <span className="streamrow__value">{format(stream.values.at(-1) ?? 0, stream.unit)}</span>
        {compact ? null : <ChevronIcon />}
      </div>

      {density === 'Year grid' ? (
        <div className="yeargrid" aria-hidden>
          {stream.values.slice(-364).map((v, i) => (
            <i key={i} style={{ background: shade(stream.dot, v, max) }} />
          ))}
        </div>
      ) : null}

      {density === '30 days' ? (
        <div className="strip" aria-hidden>
          {last30.map((v, i) => (
            <i key={i} style={{ background: shade(stream.dot, v, max) }} />
          ))}
        </div>
      ) : null}

      {density === 'Curve' ? <Curve values={last30} max={max} colour={stream.dot} /> : null}

      {density === 'Bars' ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44 }} aria-hidden>
          {last30.map((v, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${max > 0 ? Math.max(6, (v / max) * 100) : 6}%`,
                borderRadius: 2.5,
                background: v > 0 ? stream.dot : 'var(--line-1)',
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Curve({ values, max, colour }: { values: number[]; max: number; colour: string }) {
  if (values.length < 2) return null;
  const w = 100;
  const h = 30;
  const step = w / (values.length - 1);
  const y = (v: number) => h - (max > 0 ? v / max : 0) * (h - 3) - 1.5;

  const line = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 44, display: 'block' }}
      aria-hidden
    >
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`color-mix(in srgb, ${colour} 18%, #fff)`} />
      <path
        d={line}
        fill="none"
        stroke={colour}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
