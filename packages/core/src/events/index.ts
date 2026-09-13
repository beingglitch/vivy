import { z } from 'zod';
import { EventEnvelope } from './base';
import {
  MealPayload,
  MediaWatchPayload,
  MoneyBalancePayload,
  MoneyHoldingPayload,
  MoneyTxnPayload,
  NotePayload,
  ScreenAppPayload,
  ScreenSitePayload,
  SleepPayload,
  SocialPostPayload,
} from './payloads';

export * from './base';
export * from './payloads';

/**
 * The event registry.
 *
 * This union is the single source of truth for what Vivy can know. The web app,
 * the extension, the daemon and the Android schema generator all read it, so
 * adding a variant here is what makes a new signal exist everywhere at once -
 * and removing a field is a compile error in four places rather than silent
 * data loss in one.
 */
const variant = <T extends string, P extends z.ZodTypeAny>(type: T, payload: P) =>
  EventEnvelope.extend({ type: z.literal(type), payload });

export const VivyEvent = z.discriminatedUnion('type', [
  variant('screen.app', ScreenAppPayload),
  variant('screen.site', ScreenSitePayload),
  variant('media.watch', MediaWatchPayload),
  variant('social.post', SocialPostPayload),
  variant('money.txn', MoneyTxnPayload),
  variant('money.balance', MoneyBalancePayload),
  variant('money.holding', MoneyHoldingPayload),
  variant('wellbeing.sleep', SleepPayload),
  variant('wellbeing.meal', MealPayload),
  variant('note', NotePayload),
]);

export type VivyEvent = z.infer<typeof VivyEvent>;
export type VivyEventType = VivyEvent['type'];

/** Narrow a generic event to one variant. Keeps call sites free of casts. */
export function isEventType<T extends VivyEventType>(
  event: VivyEvent,
  type: T,
): event is Extract<VivyEvent, { type: T }> {
  return event.type === type;
}

export const EVENT_TYPES = [
  'screen.app',
  'screen.site',
  'media.watch',
  'social.post',
  'money.txn',
  'money.balance',
  'money.holding',
  'wellbeing.sleep',
  'wellbeing.meal',
  'note',
] as const satisfies readonly VivyEventType[];
