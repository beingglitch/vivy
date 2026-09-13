/**
 * Vivy reasons in *your* days, not UTC days. A video watched at 01:30 belongs to
 * the night before, and the year grid has to agree with how the day felt.
 *
 * Every event therefore carries three things: the true instant (`ts`), the IANA
 * zone it was observed in (`tz`), and the local calendar date derived from both
 * (`localDate`). Storing the derived date is deliberate denormalisation - it is
 * what lets a rollup group by day without re-deriving zones per row.
 */

/** YYYY-MM-DD */
export type IsoDate = string;

export function localDateOf(ts: Date | string | number, tz: string): IsoDate {
  const date = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(date.getTime())) throw new TypeError(`invalid timestamp: ${String(ts)}`);

  // en-CA formats as YYYY-MM-DD, which is the shape we store.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Inclusive range of local dates, oldest first. Used by rollups and backfill. */
export function dateRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) {
    throw new TypeError(`invalid date range: ${from}..${to}`);
  }
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
