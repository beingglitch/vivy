// Safe parsing for URL query params. A bad value (?limit=abc, ?since=garbage)
// should clamp or be ignored — never reach the DB and cause a 500.

/** Parse a query param as an integer, clamped to [min, max]. Missing or non-numeric → fallback. */
export function intParam(
  raw: string | null,
  { fallback, min = 1, max }: { fallback: number; min?: number; max: number },
): number {
  if (raw === null || raw.trim() === '') return fallback;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Parse a query param as a Date. Missing or unparseable → null. */
export function dateParam(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
