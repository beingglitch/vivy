// Shared query-param parsing. Read numbers off a URL the safe way: a missing,
// non-numeric, or negative value never reaches the database as `LIMIT NaN` or a
// backwards day-window. The result is always a whole number inside [min, max].

// Parse a bounded positive integer query param. `raw` is what URLSearchParams
// hands back (a string, or null when absent). Anything that isn't a real number
// falls back to `fallback`; the rest is floored and clamped into [min, max].
export function intParam(
  raw: string | null,
  { fallback, max, min = 1 }: { fallback: number; max: number; min?: number },
): number {
  if (raw === null || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), min), max);
}
