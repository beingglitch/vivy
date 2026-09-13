import { z } from 'zod';
import { confidence, isoDate, isoDateTime } from './base';

/**
 * One payload schema per event type.
 *
 * Rule for adding a field: derived events are rebuildable, so a new field is
 * cheap - add it, bump the parser version, re-derive. Never add a field here
 * that cannot be reconstructed from `raw_records`, because it would not survive
 * the next rebuild.
 */

/** An app or window held the foreground. The unit of all screen-time charts. */
export const ScreenAppPayload = z.object({
  app: z.string().min(1), // package name on Android, WM_CLASS on Linux
  title: z.string().nullable().default(null),
  category: z.string().nullable().default(null), // filled by Tier 1, not the collector
});

/** A website held the foreground tab. Separate from `screen.app` so browsers split by site. */
export const ScreenSitePayload = z.object({
  domain: z.string().min(1),
  url: z.string().nullable().default(null),
  title: z.string().nullable().default(null),
  category: z.string().nullable().default(null),
});

/** Something was watched. `positionS` lets a resumed video merge instead of double-counting. */
export const MediaWatchPayload = z.object({
  platform: z.enum(['youtube', 'instagram', 'x', 'other']),
  externalId: z.string().nullable().default(null), // videoId, reel id
  title: z.string().nullable().default(null),
  channel: z.string().nullable().default(null),
  lengthS: z.number().int().positive().nullable().default(null),
  positionS: z.number().int().nonnegative().nullable().default(null),
  category: z.string().nullable().default(null),
});

/** You posted something. Pulled server-side on cron, not observed on a device. */
export const SocialPostPayload = z.object({
  platform: z.enum(['youtube', 'instagram', 'x']),
  externalId: z.string().min(1),
  kind: z.enum(['post', 'video', 'short', 'reel', 'story', 'thread']),
  url: z.string().nullable().default(null),
  caption: z.string().nullable().default(null),
  metrics: z.record(z.string(), z.number()).default({}), // views, likes - shape varies per platform
});

/**
 * Money moved.
 *
 * Amounts are integer minor units (paise). Floating-point rupees drift, and a
 * ledger that disagrees with itself by a rounding error is worse than no ledger.
 */
export const MoneyTxnPayload = z.object({
  accountRef: z.string().min(1), // last 4 digits or account alias - never a full number
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3).default('INR'),
  direction: z.enum(['debit', 'credit']),
  method: z.enum(['upi', 'card', 'netbanking', 'cash', 'auto-debit', 'transfer', 'unknown']),
  counterparty: z.string().nullable().default(null), // merchant name or VPA
  category: z.string().nullable().default(null),
  balanceAfterMinor: z.number().int().nullable().default(null), // many Indian bank SMS include this
  confidence,
});

/** An authoritative balance, from a statement or a broker API. Anchors the ledger. */
export const MoneyBalancePayload = z.object({
  accountRef: z.string().min(1),
  balanceMinor: z.number().int(),
  currency: z.string().length(3).default('INR'),
  asOf: isoDate,
  authority: z.enum(['statement', 'broker-api', 'cas', 'manual', 'sms-inferred']),
});

/** What you hold. One row per symbol per observation. */
export const MoneyHoldingPayload = z.object({
  accountRef: z.string().min(1),
  symbol: z.string().min(1),
  instrument: z.enum(['equity', 'mutual-fund', 'etf', 'bond', 'other']),
  quantity: z.number(),
  avgCostMinor: z.number().int().nullable().default(null),
  asOf: isoDate,
});

export const SleepPayload = z.object({
  startedAt: isoDateTime,
  endedAt: isoDateTime,
  quality: z.number().int().min(1).max(5).nullable().default(null),
});

export const MealPayload = z.object({
  description: z.string().min(1),
  kind: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).nullable().default(null),
});

/** Free text you gave Vivy that did not parse into anything more specific. */
export const NotePayload = z.object({
  text: z.string().min(1),
  tags: z.array(z.string()).default([]),
});
