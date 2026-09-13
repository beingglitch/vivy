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
