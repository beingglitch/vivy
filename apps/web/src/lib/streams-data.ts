import 'server-only';
import { and, eq, gte } from 'drizzle-orm';
import { STREAMS } from '@vivy/core';
import { db, metricsDaily } from '@vivy/db';

/**
 * What Home draws.
 *
 * Reads `metrics_daily`, which the nightly rollup fills. Until a collector has
 * pushed something there is nothing here, and the screen says so rather than
 * inventing numbers.
 *
 * The stream *registry* is static, so adding a chart stays a one-line change in
 * `@vivy/core`; only the values come from the database.
 */

export interface StreamRow {
  key: string;
  name: string;
  dot: string;
  unit: string;
  /** Most recent 364 local dates, oldest first. Empty until rollups exist. */
  values: number[];
}

const RAMP_COLOURS: Record<string, string> = {
  indigo: '#4F46E5',
  amber: '#E0821A',
  teal: '#159E96',
  green: '#2FA84F',
  rose: '#D6455F',
};

export async function loadStreams(userId: string): Promise<StreamRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - 364);
  const sinceDate = since.toISOString().slice(0, 10);

  let rows: { stream: string; localDate: string; value: number }[] = [];
  try {
    rows = await db()
      .select({
        stream: metricsDaily.stream,
        localDate: metricsDaily.localDate,
        value: metricsDaily.value,
      })
      .from(metricsDaily)
      .where(and(eq(metricsDaily.userId, userId), gte(metricsDaily.localDate, sinceDate)));
  } catch {
    // No table yet on a fresh clone. An empty Home is the correct answer.
  }

  const byStream = new Map<string, number[]>();
  for (const row of rows) {
    byStream.set(row.stream, [...(byStream.get(row.stream) ?? []), row.value]);
  }

  return STREAMS.map((stream) => ({
    key: stream.key,
    name: stream.label,
    dot: RAMP_COLOURS[stream.ramp] ?? '#4F46E5',
    unit: stream.unit,
    values: byStream.get(stream.key) ?? [],
  }));
}

/** Whether anything has been rolled up at all. Decides empty vs populated. */
export function hasAnyData(streams: readonly StreamRow[]): boolean {
  return streams.some((s) => s.values.length > 0);
}
