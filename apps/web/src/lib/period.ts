/**
 * Period arithmetic, with no server dependencies.
 *
 * Separate from `access.ts` because the picker is a client component and needs
 * `PERIOD_UNITS` as a real value at runtime. `access.ts` is `server-only`, so
 * importing from it would pull the database into the browser bundle and fail
 * the build.
 */

export type PeriodUnit = 'day' | 'week' | 'month' | 'year';

export const PERIOD_UNITS: readonly PeriodUnit[] = ['day', 'week', 'month', 'year'];

/**
 * Add a period using calendar arithmetic, not a day count.
 *
 * "3 months" from 31 January is 30 April, not 1 May, and not 91 days. JavaScript
 * clamps the overflow for us; the important part is that months are added as
 * months rather than converted to days first.
 */
export function addPeriod(from: Date, amount: number, unit: PeriodUnit): Date {
  const out = new Date(from);
  switch (unit) {
    case 'day':
      out.setDate(out.getDate() + amount);
      break;
    case 'week':
      out.setDate(out.getDate() + amount * 7);
      break;
    case 'month':
      out.setMonth(out.getMonth() + amount);
      break;
    case 'year':
      out.setFullYear(out.getFullYear() + amount);
      break;
  }
  return out;
}

export function describePeriod(amount: number, unit: PeriodUnit): string {
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
}

export function isPeriodUnit(value: string): value is PeriodUnit {
  return (PERIOD_UNITS as readonly string[]).includes(value);
}
