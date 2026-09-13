import { z } from 'zod';
import { Source, isoDateTime, uuid } from './events/base';

/**
 * What collectors actually write.
 *
 * A raw record is verbatim and never updated. This is the one table where being
 * boring pays: a bank rewords its SMS template, a site reshuffles its DOM, a
 * parser turns out to have been wrong for a month - and because the original
 * string is still here, the fix is retroactive rather than a gap in history.
 *
 * `sealed` marks a body that was encrypted on the device before upload. The
 * server stores ciphertext it cannot read; only devices holding the stream key
 * can decrypt it. See docs/adr/0004-sealed-streams.md.
 */
export const RawRecord = z.object({
  id: uuid,
  ts: isoDateTime,
  source: Source,
  deviceId: z.string().min(1).max(64),
  /** Verbatim observation, or `{ ct, iv }` when `sealed` is true. */
  body: z.record(z.string(), z.unknown()),
  sealed: z.boolean().default(false),
  dedupeKey: z.string().min(1).max(256),
});
export type RawRecord = z.infer<typeof RawRecord>;

/**
 * Streams whose raw bodies are encrypted client-side by default.
 *
 * The rule is not "encrypt everything": aggregates stay readable so the cloud
 * model can reason over them. What gets sealed is the detail that would be
 * damaging in a database dump and is useless to the assistant in raw form.
 */
export const SEALED_SOURCES = new Set<Source>(['android.a11y', 'android.sms', 'server.gmail']);

export function shouldSeal(source: Source): boolean {
  return SEALED_SOURCES.has(source);
}
