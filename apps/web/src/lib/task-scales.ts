/**
 * The two scales a task is measured on.
 *
 * Split out of `lib/tasks.ts` because that file is server-only and the pickers
 * are client components. Both are deliberately coarse: nobody knows whether a
 * job is 35 or 40 minutes, and asking stops people writing anything down.
 */
export const IMPORTANCE = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'Normal' },
  { value: 3, label: 'High' },
  { value: 4, label: 'Critical' },
] as const;

export const EFFORTS = [
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours +' },
] as const;

/**
 * What a missed deadline means.
 *
 * The quadrant cannot infer this and it changes everything about what happens
 * on the day after. Two tasks with the same date behave in opposite ways.
 */
export const DEADLINE_KINDS = [
  { value: 'none', label: 'No deadline', hint: 'Do it whenever. Nothing changes with time.' },
  {
    value: 'expires',
    label: 'Gone if missed',
    hint: 'The work dies with the date. A grant you did not apply for is not still waiting.',
  },
  {
    value: 'persists',
    label: 'Still needed',
    hint: 'The date passing changes nothing. A late assignment is still an assignment.',
  },
] as const;

export type DeadlineKind = (typeof DEADLINE_KINDS)[number]['value'];

/** Common "in N" windows, so a rough deadline is one tap rather than a date picker. */
export const DUE_PERIODS = [
  { amount: 1, unit: 'day', label: 'Tomorrow' },
  { amount: 3, unit: 'day', label: 'In 3 days' },
  { amount: 1, unit: 'week', label: 'In a week' },
  { amount: 2, unit: 'week', label: 'In 2 weeks' },
  { amount: 1, unit: 'month', label: 'In a month' },
  { amount: 3, unit: 'month', label: 'In 3 months' },
] as const;

/** How close counts as "here", for a task pinned to a place. */
export const RADII = [
  { value: 100, label: '100 m' },
  { value: 250, label: '250 m' },
  { value: 500, label: '500 m' },
  { value: 1000, label: '1 km' },
  { value: 2000, label: '2 km' },
] as const;

export function addPeriodTo(base: Date, amount: number, unit: string): Date {
  const d = new Date(base);
  if (unit === 'day') d.setDate(d.getDate() + amount);
  else if (unit === 'week') d.setDate(d.getDate() + amount * 7);
  else if (unit === 'month') d.setMonth(d.getMonth() + amount);
  else if (unit === 'year') d.setFullYear(d.getFullYear() + amount);
  return d;
}

/**
 * Turn a point on the grid back into the two numbers behind it.
 *
 * The inverse of `place`, so clicking where a task belongs is the same gesture
 * as reading where it sits. Both snap to the scales, because the pickers only
 * offer those values and a dot that cannot be reproduced by the form would be
 * a lie about what was stored.
 */
export function unplace(xPercent: number, yPercent: number) {
  const xRaw = Math.min(Math.max((xPercent - 6) / 0.88, 0), 100);
  const minutes = 5 * Math.exp((xRaw / 100) * (Math.log(240) - Math.log(5)));
  const effortMinutes = EFFORTS.reduce((best, e) =>
    Math.abs(e.value - minutes) < Math.abs(best.value - minutes) ? e : best,
  ).value;

  const weight = Math.min(Math.max(1 - (yPercent - 6) / 88, 0), 1);
  const importance = Math.min(4, Math.max(1, Math.round(weight * 3 + 1)));

  return { effortMinutes, importance };
}
