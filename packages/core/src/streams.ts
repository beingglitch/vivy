import type { VivyEventType } from './events/index';

/**
 * Metric streams - the things the home canvas draws.
 *
 * A stream is a named daily aggregation over `events`. Registering one here is
 * the entire cost of adding a chart: the rollup job reads this list, and the UI
 * reads `metrics_daily`. No migration, no new table.
 *
 * `unit` drives axis formatting and `ramp` drives the year-grid colour scale, so
 * a new stream renders correctly without touching chart code.
 */
export interface StreamDef {
  readonly key: string;
  readonly label: string;
  readonly from: readonly VivyEventType[];
  readonly unit: 'seconds' | 'count' | 'minor-currency' | 'ratio';
  readonly ramp: 'indigo' | 'amber' | 'teal' | 'rose';
  /** Higher is better? Drives whether the grid reads a dark cell as good or bad. */
  readonly polarity: 'up-good' | 'down-good' | 'neutral';
}

export const STREAMS = [
  {
    key: 'screen.total',
    label: 'Screen time',
    from: ['screen.app'],
    unit: 'seconds',
    ramp: 'rose',
    polarity: 'down-good',
  },
  {
    key: 'screen.social',
    label: 'Social',
    from: ['screen.app', 'screen.site'],
    unit: 'seconds',
    ramp: 'rose',
    polarity: 'down-good',
  },
  {
    key: 'media.watch.total',
    label: 'Video watched',
    from: ['media.watch'],
    unit: 'seconds',
    ramp: 'amber',
    polarity: 'neutral',
  },
  {
    key: 'media.watch.learning',
    label: 'Learning video',
    from: ['media.watch'],
    unit: 'seconds',
    ramp: 'teal',
    polarity: 'up-good',
  },
  {
    key: 'social.posts',
    label: 'Posts shipped',
    from: ['social.post'],
    unit: 'count',
    ramp: 'indigo',
    polarity: 'up-good',
  },
  {
    key: 'money.spend',
    label: 'Spent',
    from: ['money.txn'],
    unit: 'minor-currency',
    ramp: 'amber',
    polarity: 'down-good',
  },
  {
    key: 'money.networth',
    label: 'Net worth',
    from: ['money.balance', 'money.holding'],
    unit: 'minor-currency',
    ramp: 'teal',
    polarity: 'up-good',
  },
  {
    key: 'sleep.hours',
    label: 'Sleep',
    from: ['wellbeing.sleep'],
    unit: 'seconds',
    ramp: 'indigo',
    polarity: 'up-good',
  },
] as const satisfies readonly StreamDef[];

export type StreamKey = (typeof STREAMS)[number]['key'];

export function streamDef(key: string): StreamDef | undefined {
  return STREAMS.find((s) => s.key === key);
}
