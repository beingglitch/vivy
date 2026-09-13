import { z } from 'zod';

/**
 * Primitives shared by every schema in this package.
 *
 * These are deliberately regex-based rather than using zod's built-in `.uuid()`
 * / `.datetime()` refinements: the same schemas are compiled into a browser
 * extension, a Node daemon and a Next.js server, and pinning the validation to
 * plain string shapes keeps behaviour identical across zod majors.
 */

export const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'expected a UUID');

export const isoDateTime = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    'expected an ISO-8601 datetime',
  );

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

/** IANA zone, e.g. `Asia/Kolkata`. Validated loosely; Intl is the real authority. */
export const timeZone = z.string().min(1).max(64);

/**
 * Which collector produced a record. Namespaced `<device>.<collector>` so a
 * parser bug can be traced to one binary, and so re-derivation can target a
 * single source without touching the rest.
 */
export const Source = z.enum([
  'android.usage',
  'android.a11y',
  'android.notification',
  'android.sms',
  'chrome.tabs',
  'chrome.youtube',
  'chrome.social',
  'linux.window',
  'server.youtube',
  'server.instagram',
  'server.kite',
  'server.gmail',
  'manual.chat',
  'manual.voice',
]);
export type Source = z.infer<typeof Source>;

/**
 * Fields every derived event carries, whatever its type.
 *
 * `rawId` is provenance and is non-negotiable: it is what makes re-derivation
 * possible. `derivedBy` records the parser version, so when a parser improves
 * you know exactly which rows to rebuild.
 */
export const EventEnvelope = z.object({
  id: uuid,
  ts: isoDateTime,
  localDate: isoDate,
  tz: timeZone,
  source: Source,
  deviceId: z.string().min(1).max(64),
  durationS: z.number().int().nonnegative().nullable().default(null),
  rawId: uuid.nullable().default(null),
  derivedBy: z.string().min(1).max(64),
  /**
   * Idempotency key, built with `dedupeKey()` from the observation itself.
   *
   * Distinct from `id`: a re-derivation mints a new row id but must land on the
   * same dedupe key, so rebuilding events twice cannot double-count a day.
   */
  dedupeKey: z.string().min(1).max(256),
});
export type EventEnvelope = z.infer<typeof EventEnvelope>;

/**
 * How much to trust a derived value.
 *
 * Every parser emits one. The money reconciler uses it to decide which window a
 * balance drift is most likely to have come from, and the UI uses it to mark
 * rows that want a human glance. A parser that cannot express doubt produces a
 * ledger that rots silently.
 */
export const confidence = z.number().min(0).max(1);
