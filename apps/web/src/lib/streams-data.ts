import 'server-only';
import { and, eq, gte, isNull } from 'drizzle-orm';
import { STREAMS } from '@vivy/core';
import { areas, db, metricsDaily, tasks } from '@vivy/db';

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
  kind: 'metric' | 'area';
  /** Most recent 364 local dates, oldest first. */
  dates: string[];
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
  const dates = Array.from({ length: 364 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (363 - index));
    return date.toLocaleDateString('en-CA');
  });
  const sinceDate = dates[0]!;
  const dateIndex = new Map(dates.map((date, index) => [date, index]));

  let rows: { stream: string; localDate: string; value: number }[] = [];
  let areaRows: { id: string; name: string; colour: string }[] = [];
  let completedRows: { areaId: string | null; completedAt: Date | null }[] = [];
  try {
    [rows, areaRows, completedRows] = await Promise.all([
      db()
        .select({
          stream: metricsDaily.stream,
          localDate: metricsDaily.localDate,
          value: metricsDaily.value,
        })
        .from(metricsDaily)
        .where(and(eq(metricsDaily.userId, userId), gte(metricsDaily.localDate, sinceDate))),
      db()
        .select({ id: areas.id, name: areas.name, colour: areas.colour })
        .from(areas)
        .where(and(eq(areas.userId, userId), isNull(areas.archivedAt))),
      db()
        .select({ areaId: tasks.areaId, completedAt: tasks.completedAt })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.status, 'done'),
            gte(tasks.completedAt, new Date(`${sinceDate}T00:00:00`)),
          ),
        ),
    ]);
  } catch {
    // No table yet on a fresh clone. An empty Home is the correct answer.
  }

  const byStream = new Map<string, number[]>();
  for (const row of rows) {
    const index = dateIndex.get(row.localDate);
    if (index === undefined) continue;
    const values = byStream.get(row.stream) ?? Array<number>(dates.length).fill(0);
    values[index] = row.value;
    byStream.set(row.stream, values);
  }

  const areaValues = new Map(
    areaRows.map((area) => [area.id, Array<number>(dates.length).fill(0)]),
  );
  for (const row of completedRows) {
    if (!row.areaId || !row.completedAt) continue;
    const index = dateIndex.get(row.completedAt.toLocaleDateString('en-CA'));
    const values = areaValues.get(row.areaId);
    if (index !== undefined && values) values[index] = (values[index] ?? 0) + 1;
  }

  const metricStreams: StreamRow[] = STREAMS.map((stream) => ({
    key: stream.key,
    name: stream.label,
    dot: RAMP_COLOURS[stream.ramp] ?? '#4F46E5',
    unit: stream.unit,
    kind: 'metric',
    dates,
    values: byStream.get(stream.key) ?? Array<number>(dates.length).fill(0),
  }));

  const focusAreaStreams: StreamRow[] = areaRows.map((area) => ({
    key: `area:${area.id}`,
    name: area.name,
    dot: area.colour,
    unit: 'count',
    kind: 'area',
    dates,
    values: areaValues.get(area.id) ?? Array<number>(dates.length).fill(0),
  }));

  return [...metricStreams, ...focusAreaStreams];
}
