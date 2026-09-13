import { z } from 'zod';
import { VivyEvent } from '../events/index';
import { RawRecord } from '../raw';
import { isoDate } from '../events/base';

/**
 * The whole sync protocol.
 *
 * It is this small because almost every write in Vivy is an immutable append:
 * nothing edits another device's rows, so there are no conflicts to resolve and
 * no merge strategy to get wrong. Push is idempotent via `dedupeKey`; pull is a
 * monotonic cursor. See docs/adr/0002-append-only-sync.md.
 */

export const MAX_BATCH = 500;

/**
 * Where a device has read up to.
 *
 * Two counters rather than one because `raw_records` and `events` advance
 * independently: a re-derivation rewrites every event without touching a single
 * raw row, and a device that only wants derived data should not be dragged
 * through the raw sequence to find it.
 */
export const SyncCursor = z.object({
  raw: z.number().int().nonnegative().default(0),
  events: z.number().int().nonnegative().default(0),
});
export type SyncCursor = z.infer<typeof SyncCursor>;

export const ZERO_CURSOR: SyncCursor = { raw: 0, events: 0 };

export const PushRequest = z.object({
  deviceId: z.string().min(1).max(64),
  /** Client clock, for drift diagnostics only. The server never trusts it for ordering. */
  sentAt: z.string(),
  raw: z.array(RawRecord).max(MAX_BATCH).default([]),
  events: z.array(VivyEvent).max(MAX_BATCH).default([]),
  /**
   * What the collector is running, reported on every sync.
   *
   * Optional because older builds do not send it, and because a collector that
   * cannot say its version must still be able to deliver data. It is how the
   * web app knows a phone is behind without asking the phone anything.
   */
  appVersionCode: z.number().int().positive().optional(),
  appVersionName: z.string().max(32).optional(),
});
export type PushRequest = z.infer<typeof PushRequest>;

export const PushResponse = z.object({
  acceptedRaw: z.number().int().nonnegative(),
  acceptedEvents: z.number().int().nonnegative(),
  /** Rows the server already had. Expected and healthy - it means replay worked. */
  duplicates: z.number().int().nonnegative(),
  /** High-water mark after this write, so a client can pull from here. */
  cursor: SyncCursor,
});
export type PushResponse = z.infer<typeof PushResponse>;

export const PullRequest = z.object({
  deviceId: z.string().min(1).max(64),
  /** Everything after these sequence numbers. Zeroes on a fresh device. */
  cursor: SyncCursor.default(ZERO_CURSOR),
  limit: z.number().int().positive().max(MAX_BATCH).default(200),
  /**
   * Retention window. The device only wants raw and events this recent; rollups
   * always come in full because they are small and they are what charts read.
   */
  since: isoDate.nullable().default(null),
  include: z
    .array(z.enum(['raw', 'events', 'rollups', 'ledger']))
    .default(['events', 'rollups', 'ledger']),
});
export type PullRequest = z.infer<typeof PullRequest>;

export const MetricDaily = z.object({
  localDate: isoDate,
  stream: z.string().min(1),
  value: z.number(),
  meta: z.record(z.string(), z.unknown()).default({}),
});
export type MetricDaily = z.infer<typeof MetricDaily>;

export const PullResponse = z.object({
  cursor: SyncCursor,
  hasMore: z.boolean(),
  raw: z.array(RawRecord).default([]),
  events: z.array(VivyEvent).default([]),
  rollups: z.array(MetricDaily).default([]),
});
export type PullResponse = z.infer<typeof PullResponse>;

/**
 * Backfill: the user scrolled a chart past their retention window.
 *
 * Deliberately a separate endpoint rather than a wider pull - it is user-driven
 * and latency-visible, where sync is background and can be slow.
 */
export const BackfillRequest = z.object({
  deviceId: z.string().min(1).max(64),
  from: isoDate,
  to: isoDate,
  types: z.array(z.string()).default([]),
});
export type BackfillRequest = z.infer<typeof BackfillRequest>;
