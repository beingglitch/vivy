'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Empty } from '@/components/empty';
import { ChevronIcon, MenuIcon, PlusIcon } from '@/components/icons';
import {
  STREAM_COLOURS,
  STREAM_GRAPH_STYLES,
  type StreamPipelineDefinition,
  type StreamPipelineOptions,
} from '@/lib/stream-pipeline-shared';
import type { StreamRow } from '@/lib/streams-data';
import { addStreamPipeline } from './stream-actions';

const GRAPH_STYLES = STREAM_GRAPH_STYLES;
const WINDOWS = [
  { label: '30 days', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 182 },
  { label: '1 year', days: 364 },
] as const;
const STORE_KEY = 'vivy.stream-preferences.v1';

type GraphStyle = (typeof GRAPH_STYLES)[number];

interface Preferences {
  visibleKeys: string[];
  order: string[];
  graphStyles: Record<string, GraphStyle>;
}

function defaultGraph(stream: StreamRow): GraphStyle {
  if (stream.graphStyle) return stream.graphStyle;
  if (stream.key.startsWith('money.')) return 'Curve';
  if (stream.key.startsWith('media.watch.')) return 'Bars';
  return 'Heatmap';
}

function format(value: number, unit: string): string {
  if (unit === 'seconds') {
    const minutes = Math.round(value / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  }
  if (unit === 'minor-currency') return `₹${Math.round(value / 100).toLocaleString('en-IN')}`;
  if (unit === 'ratio') return `${Math.round(value * 100)}%`;
  return String(Math.round(value));
}

function shade(base: string, value: number, max: number): string {
  if (value <= 0 || max <= 0) return 'var(--line-1)';
  const step = Math.min(3, Math.floor((value / max) * 4));
  const percentage = [22, 45, 72, 100][step] ?? 100;
  return percentage === 100 ? base : `color-mix(in srgb, ${base} ${percentage}%, #F2F1ED)`;
}

function streaks(values: number[]) {
  let current = 0;
  for (let index = values.length - 1; index >= 0 && (values[index] ?? 0) > 0; index -= 1) {
    current += 1;
  }

  let max = 0;
  let run = 0;
  for (const value of values) {
    run = value > 0 ? run + 1 : 0;
    max = Math.max(max, run);
  }
  return { current, max };
}

function initialPreferences(streams: StreamRow[]): Preferences {
  const visibleKeys = streams
    .filter(
      (stream) =>
        stream.kind === 'area' ||
        stream.kind === 'custom' ||
        (stream.kind === 'metric' && stream.values.some((value) => value !== 0)),
    )
    .map((stream) => stream.key);
  return {
    visibleKeys,
    order: visibleKeys,
    graphStyles: Object.fromEntries(streams.map((stream) => [stream.key, defaultGraph(stream)])),
  };
}

export function StreamsScreen({
  streams,
  pipelineOptions,
}: {
  streams: StreamRow[];
  pipelineOptions: StreamPipelineOptions;
}) {
  const defaults = useMemo(() => initialPreferences(streams), [streams]);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [hydrated, setHydrated] = useState(false);
  const [adding, setAdding] = useState(false);
  const [building, setBuilding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(364);
  const [offsetDays, setOffsetDays] = useState(0);
  const draggingKey = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(STORE_KEY) ?? 'null',
      ) as Partial<Preferences> | null;
      const validKeys = new Set(streams.map((stream) => stream.key));
      if (saved) {
        const accountVisibleKeys = streams
          .filter((stream) => stream.kind === 'area' || stream.kind === 'custom')
          .map((stream) => stream.key);
        const visibleKeys = [
          ...new Set([
            ...(saved.visibleKeys ?? []).filter((key) => validKeys.has(key)),
            ...accountVisibleKeys,
          ]),
        ];
        const order = [
          ...(saved.order ?? []).filter((key) => visibleKeys.includes(key)),
          ...visibleKeys.filter((key) => !(saved.order ?? []).includes(key)),
        ];
        const graphStyles = { ...defaults.graphStyles };
        for (const [key, style] of Object.entries(saved.graphStyles ?? {})) {
          if (validKeys.has(key) && GRAPH_STYLES.includes(style as GraphStyle)) {
            graphStyles[key] = style as GraphStyle;
          }
        }
        setPreferences({ visibleKeys, order, graphStyles });
      }
    } catch {
      setPreferences(defaults);
    }
    setHydrated(true);
  }, [defaults, streams]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(preferences));
    } catch {}
  }, [hydrated, preferences]);

  const byKey = useMemo(() => new Map(streams.map((stream) => [stream.key, stream])), [streams]);
  const visibleStreams = preferences.order
    .filter((key) => preferences.visibleKeys.includes(key))
    .flatMap((key) => {
      const stream = byKey.get(key);
      return stream ? [stream] : [];
    });
  const addableStreams = streams;
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  function createSelectedStreams() {
    if (selectedStreams.length === 0) return;
    setPreferences((current) => {
      const added = selectedStreams.filter((key) => !current.visibleKeys.includes(key));
      return {
        ...current,
        visibleKeys: [...current.visibleKeys, ...added],
        order: [...current.order, ...added],
      };
    });
    setSelectedStreams([]);
    setAdding(false);
  }

  function moveStream(source: string, target: string) {
    if (source === target) return;
    setPreferences((current) => {
      const targetIndex = current.order.indexOf(target);
      const order = current.order.filter((key) => key !== source);
      const insertionIndex = targetIndex < 0 ? order.length : targetIndex;
      order.splice(insertionIndex, 0, source);
      return { ...current, order };
    });
  }

  function shiftWindow(direction: 'older' | 'newer') {
    const step = Math.max(7, Math.floor(windowDays / 2));
    setOffsetDays((current) =>
      direction === 'older'
        ? Math.min(364 - windowDays, current + step)
        : Math.max(0, current - step),
    );
  }

  return (
    <>
      <div className="header streams-header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Streams</h1>
            <span className="subtitle">{today}</span>
          </div>
          <div className="header__actions">
            <button
              className={`iconbtn${managing ? ' iconbtn--active' : ''}`}
              aria-label={managing ? 'Finish managing streams' : 'Manage streams'}
              onClick={() => {
                setManaging((current) => !current);
                setAdding(false);
              }}
            >
              <MenuIcon />
            </button>
            <button
              className="iconbtn iconbtn--solid"
              aria-label="Add or build streams"
              onClick={() => {
                setAdding((current) => !current);
                setManaging(false);
              }}
            >
              <PlusIcon />
            </button>
          </div>
        </div>

        <div className="stream-window" aria-label="Visible graph range">
          {WINDOWS.map((option) => (
            <button
              type="button"
              key={option.days}
              className="chip"
              aria-selected={windowDays === option.days}
              onClick={() => {
                setWindowDays(option.days);
                setOffsetDays((current) => Math.min(current, 364 - option.days));
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="screen screen--flush streams-screen">
        {adding ? (
          <section className="stream-create" aria-label="Add streams">
            <div className="stream-create__head">
              <div>
                <strong>New streams</strong>
                <span>Select metrics or focus areas</span>
              </div>
              <button type="button" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
            <button
              type="button"
              className="stream-builder-launch"
              onClick={() => {
                setAdding(false);
                setBuilding(true);
              }}
            >
              <PlusIcon size={18} />
              <span>
                <strong>Build a custom stream</strong>
                <small>Choose a source, calculation and graph</small>
              </span>
            </button>
            {addableStreams.length > 0 ? (
              <div className="stream-create__areas">
                {addableStreams.map((stream) => {
                  const visible = preferences.visibleKeys.includes(stream.key);
                  const selected = selectedStreams.includes(stream.key);
                  return (
                    <button
                      type="button"
                      key={stream.key}
                      className={`stream-area${selected ? ' stream-area--selected' : ''}`}
                      disabled={visible}
                      onClick={() =>
                        setSelectedStreams((current) =>
                          current.includes(stream.key)
                            ? current.filter((key) => key !== stream.key)
                            : [...current, stream.key],
                        )
                      }
                    >
                      <span className="dot" style={{ background: stream.dot }} />
                      <span>{stream.name}</span>
                      <span className="stream-area__state">
                        {visible
                          ? 'Added'
                          : selected
                            ? 'Selected'
                            : stream.kind === 'metric'
                              ? 'Metric'
                              : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="stream-create__empty">No streams are available.</p>
            )}
            <button
              type="button"
              className="btn btn--primary stream-create__submit"
              disabled={selectedStreams.length === 0}
              onClick={createSelectedStreams}
            >
              Add {selectedStreams.length || ''} stream{selectedStreams.length === 1 ? '' : 's'}
            </button>
          </section>
        ) : null}

        {managing ? (
          <div className="stream-manage-note">
            <span>Drag streams to set their order</span>
            <button type="button" onClick={() => setManaging(false)}>
              Done
            </button>
          </div>
        ) : null}

        {visibleStreams.length === 0 ? (
          <Empty
            title="No streams yet"
            hint="Tap + to build a stream from balances, transactions, tasks or focus areas."
          />
        ) : (
          <div className="stream-list">
            {visibleStreams.map((stream) => (
              <StreamCard
                key={stream.key}
                stream={stream}
                graphStyle={preferences.graphStyles[stream.key] ?? defaultGraph(stream)}
                windowDays={windowDays}
                offsetDays={offsetDays}
                editing={editingKey === stream.key}
                managing={managing}
                onEdit={() =>
                  setEditingKey((current) => (current === stream.key ? null : stream.key))
                }
                onGraphStyle={(style) =>
                  setPreferences((current) => ({
                    ...current,
                    graphStyles: { ...current.graphStyles, [stream.key]: style },
                  }))
                }
                onHide={() =>
                  setPreferences((current) => ({
                    ...current,
                    visibleKeys: current.visibleKeys.filter((key) => key !== stream.key),
                    order: current.order.filter((key) => key !== stream.key),
                  }))
                }
                onSwipe={shiftWindow}
                onDragStart={() => {
                  draggingKey.current = stream.key;
                }}
                onDragMove={(target) => {
                  if (draggingKey.current) moveStream(draggingKey.current, target);
                }}
                onDragEnd={() => {
                  draggingKey.current = null;
                }}
              />
            ))}
          </div>
        )}
      </div>
      {building ? (
        <StreamBuilder options={pipelineOptions} onClose={() => setBuilding(false)} />
      ) : null}
    </>
  );
}

function StreamBuilder({
  options,
  onClose,
}: {
  options: StreamPipelineOptions;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [source, setSource] = useState<StreamPipelineDefinition['source']>('account-balances');
  const [accountId, setAccountId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [subtractLiabilities, setSubtractLiabilities] = useState(true);
  const [direction, setDirection] = useState<'all' | 'debit' | 'credit'>('all');
  const [aggregate, setAggregate] = useState<'sum' | 'count'>('sum');
  const [graphStyle, setGraphStyle] = useState<GraphStyle>('Curve');
  const [colour, setColour] = useState<(typeof STREAM_COLOURS)[number]>(STREAM_COLOURS[1]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create() {
    const definition: StreamPipelineDefinition =
      source === 'account-balances'
        ? {
            source,
            accountIds: accountId ? [accountId] : [],
            subtractLiabilities,
          }
        : source === 'transactions'
          ? {
              source,
              accountIds: accountId ? [accountId] : [],
              direction,
              aggregate,
            }
          : { source, areaIds: areaId ? [areaId] : [] };
    start(async () => {
      const result = await addStreamPipeline({ name, colour, graphStyle, definition });
      if (!result.ok) return setError(result.error);
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="sheet-backdrop">
      <div className="money-sheet stream-builder" role="dialog" aria-modal="true">
        <div className="sheet-handle" aria-hidden />
        <div className="money-sheet__head">
          <h2>Build stream</h2>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
        <label className="money-field">
          <span>Name</span>
          <input
            value={name}
            placeholder="e.g. Net worth"
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="money-field">
          <span>Data source</span>
          <select
            value={source}
            onChange={(event) =>
              setSource(event.target.value as StreamPipelineDefinition['source'])
            }
          >
            <option value="account-balances">Account balances</option>
            <option value="transactions">Transactions</option>
            <option value="completed-tasks">Completed tasks</option>
          </select>
        </label>

        {source === 'account-balances' || source === 'transactions' ? (
          <label className="money-field">
            <span>Account scope</span>
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">
                {source === 'account-balances' ? 'All net-worth accounts' : 'All accounts'}
              </option>
              {options.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="money-field">
            <span>Focus area</span>
            <select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
              <option value="">All focus areas</option>
              {options.areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {source === 'account-balances' ? (
          <label className="money-check-row">
            <input
              type="checkbox"
              checked={subtractLiabilities}
              onChange={(event) => setSubtractLiabilities(event.target.checked)}
            />
            Subtract loans, cards and personal debts
          </label>
        ) : null}
        {source === 'transactions' ? (
          <div className="money-field-row">
            <label className="money-field">
              <span>Direction</span>
              <select
                value={direction}
                onChange={(event) => setDirection(event.target.value as 'all' | 'debit' | 'credit')}
              >
                <option value="all">All</option>
                <option value="debit">Spend</option>
                <option value="credit">Income</option>
              </select>
            </label>
            <label className="money-field">
              <span>Calculate</span>
              <select
                value={aggregate}
                onChange={(event) => setAggregate(event.target.value as 'sum' | 'count')}
              >
                <option value="sum">Total amount</option>
                <option value="count">Count</option>
              </select>
            </label>
          </div>
        ) : null}

        <div className="stream-builder__section">
          <span>Graph</span>
          <div className="stream-editor__styles">
            {GRAPH_STYLES.map((style) => (
              <button
                type="button"
                className="chip"
                aria-selected={graphStyle === style}
                key={style}
                onClick={() => setGraphStyle(style)}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
        <div className="stream-builder__section">
          <span>Colour</span>
          <div className="stream-builder__colours">
            {STREAM_COLOURS.map((option) => (
              <button
                type="button"
                key={option}
                className={colour === option ? 'stream-builder__colour--on' : ''}
                style={{ background: option }}
                aria-label={`Choose ${option}`}
                onClick={() => setColour(option)}
              />
            ))}
          </div>
        </div>
        {error ? <p className="pair__error">{error}</p> : null}
        <button
          type="button"
          className="btn btn--primary money-sheet__save"
          disabled={pending || !name.trim()}
          onClick={create}
        >
          {pending ? 'Creating…' : 'Create stream'}
        </button>
      </div>
    </div>
  );
}

function StreamCard({
  stream,
  graphStyle,
  windowDays,
  offsetDays,
  editing,
  managing,
  onEdit,
  onGraphStyle,
  onHide,
  onSwipe,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  stream: StreamRow;
  graphStyle: GraphStyle;
  windowDays: number;
  offsetDays: number;
  editing: boolean;
  managing: boolean;
  onEdit: () => void;
  onGraphStyle: (style: GraphStyle) => void;
  onHide: () => void;
  onSwipe: (direction: 'older' | 'newer') => void;
  onDragStart: () => void;
  onDragMove: (target: string) => void;
  onDragEnd: () => void;
}) {
  const swipeStart = useRef<number | null>(null);
  const end = stream.values.length - offsetDays;
  const start = Math.max(0, end - windowDays);
  const values = stream.values.slice(start, end);
  const dates = stream.dates.slice(start, end);
  const max = Math.max(...values, 0);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const magnitudeMax = Math.max(...values.map(Math.abs), 0);
  const streak = streaks(values);
  const currentValue = values.at(-1) ?? 0;
  const startLabel = dates[0]
    ? new Date(`${dates[0]}T12:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })
    : '';
  const endLabel = dates.at(-1)
    ? new Date(`${dates.at(-1)}T12:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })
    : '';

  return (
    <article
      className={`streamrow${managing ? ' streamrow--managing' : ''}`}
      data-stream-key={stream.key}
    >
      <div className="streamrow__top">
        {managing ? (
          <button
            type="button"
            className="streamrow__drag"
            aria-label={`Drag ${stream.name}`}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              onDragStart();
            }}
            onPointerMove={(event) => {
              const target = document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest<HTMLElement>('[data-stream-key]')?.dataset['streamKey'];
              if (target) onDragMove(target);
            }}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <DragIcon />
          </button>
        ) : null}
        <span className="dot" style={{ background: stream.dot }} />
        <button type="button" className="streamrow__title" onClick={onEdit}>
          <span className="streamrow__name">{stream.name}</span>
          <span className="streamrow__kind">{graphStyle}</span>
        </button>
        <span className="streamrow__value">{format(currentValue, stream.unit)}</span>
        <button
          type="button"
          className="streamrow__edit"
          onClick={onEdit}
          aria-label={`Edit ${stream.name}`}
        >
          <ChevronIcon />
        </button>
      </div>

      {editing ? (
        <div className="stream-editor">
          <div className="stream-editor__styles">
            {GRAPH_STYLES.map((style) => (
              <button
                type="button"
                key={style}
                className="chip"
                aria-selected={graphStyle === style}
                onClick={() => onGraphStyle(style)}
              >
                {style}
              </button>
            ))}
          </div>
          <button type="button" className="stream-editor__hide" onClick={onHide}>
            Hide stream
          </button>
        </div>
      ) : null}

      <div
        className="stream-chart"
        onPointerDown={(event) => {
          swipeStart.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (swipeStart.current === null) return;
          const distance = event.clientX - swipeStart.current;
          if (distance > 55) onSwipe('older');
          if (distance < -55) onSwipe('newer');
          swipeStart.current = null;
        }}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        {graphStyle === 'Heatmap' ? (
          <Heatmap values={values} max={magnitudeMax} colour={stream.dot} />
        ) : null}
        {graphStyle === 'Curve' ? (
          <Curve values={values} min={min} max={max} colour={stream.dot} />
        ) : null}
        {graphStyle === 'Bars' ? (
          <Bars values={values} max={magnitudeMax} colour={stream.dot} />
        ) : null}
      </div>

      <div className="stream-stats">
        <span>
          Current streak <strong>{streak.current}</strong>
        </span>
        <span>
          Max streak <strong>{streak.max}</strong>
        </span>
        <span>
          Min <strong>{format(min, stream.unit)}</strong>
        </span>
        <span>
          Max <strong>{format(max, stream.unit)}</strong>
        </span>
      </div>
      <div className="streamrow__range">
        <span>{startLabel}</span>
        <span>Swipe graph to move</span>
        <span>{endLabel}</span>
      </div>
    </article>
  );
}

function Heatmap({ values, max, colour }: { values: number[]; max: number; colour: string }) {
  return (
    <div
      className="stream-heatmap"
      style={{ gridTemplateColumns: `repeat(${Math.ceil(values.length / 7)}, minmax(4px, 1fr))` }}
      aria-hidden
    >
      {values.map((value, index) => (
        <i key={index} style={{ background: shade(colour, Math.abs(value), max) }} />
      ))}
    </div>
  );
}

function Curve({
  values,
  min,
  max,
  colour,
}: {
  values: number[];
  min: number;
  max: number;
  colour: string;
}) {
  if (values.length < 2) return <div className="stream-chart__empty" />;
  const width = 100;
  const height = 38;
  const step = width / (values.length - 1);
  const spread = Math.max(1, max - min);
  const points = values.map((value, index) => ({
    x: index * step,
    y: height - ((value - min) / spread) * (height - 5) - 2.5,
  }));
  const line = points.reduce((path, current, index) => {
    if (index === 0) return `M${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
    const previous = points[index - 1]!;
    const middleX = (previous.x + current.x) / 2;
    return `${path} C${middleX.toFixed(2)} ${previous.y.toFixed(2)}, ${middleX.toFixed(2)} ${current.y.toFixed(2)}, ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
  }, '');

  return (
    <svg
      className="stream-curve"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={`${line} L${width} ${height} L0 ${height} Z`}
        fill={`color-mix(in srgb, ${colour} 16%, #fff)`}
      />
      <path
        d={line}
        fill="none"
        stroke={colour}
        strokeWidth="1.7"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Bars({ values, max, colour }: { values: number[]; max: number; colour: string }) {
  return (
    <div className="stream-bars" aria-hidden>
      {values.map((value, index) => (
        <i
          key={index}
          style={{
            height: `${max > 0 && value !== 0 ? Math.max(7, (Math.abs(value) / max) * 100) : 4}%`,
            background: value !== 0 ? colour : 'var(--line-1)',
          }}
        />
      ))}
    </div>
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
