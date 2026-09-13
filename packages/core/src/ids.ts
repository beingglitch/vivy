/**
 * Identity helpers shared by every collector.
 *
 * `dedupeKey` is the backbone of the sync protocol: a collector that loses the
 * network replays its whole outbox on reconnect, and the server drops anything
 * it has already seen. That only works if the key is derived from the observed
 * fact itself - never from a clock read or a random value at send time.
 */

/** FNV-1a. Not cryptographic - this exists to keep dedupe keys short and stable. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, '0');
}

/**
 * Build a stable dedupe key.
 *
 * @param source the collector, e.g. `chrome.youtube`
 * @param parts  values identifying the observation. Must be deterministic: the
 *               same real-world event observed twice has to produce the same
 *               parts, or the row lands twice.
 */
export function dedupeKey(source: string, ...parts: (string | number)[]): string {
  const natural = parts.join(' ');
  // Readable prefix for debugging, hashed tail so the column stays bounded.
  return `${source}:${natural.slice(0, 96)}:${fnv1a(natural)}`;
}

export function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  throw new Error('crypto.randomUUID unavailable; pass an explicit id');
}
