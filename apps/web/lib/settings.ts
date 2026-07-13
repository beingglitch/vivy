import { db, settings } from '@/lib/db';

export type Profile = { name: string; dob: string };

const DEFAULTS: Profile = { name: '', dob: '' };

export async function getProfile(): Promise<Profile> {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULTS, name: map.name ?? '', dob: map.dob ?? '' };
}

// Age in years with two decimals — the clock that keeps the goal honest.
export function ageYears(dob: string): number | null {
  const d = new Date(dob + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.2425 * 86400000);
}
