/**
 * The area palette.
 *
 * Split out of `lib/areas.ts` because that file is server-only and the picker
 * is a client component: importing the list from there would drag the database
 * into the browser bundle.
 */
export const AREA_COLOURS = [
  '#4F46E5',
  '#2FA84F',
  '#E0821A',
  '#C2410C',
  '#0E7490',
  '#7C3AED',
  '#BE185D',
  '#4D7C0F',
] as const;

export type AreaColour = (typeof AREA_COLOURS)[number];
