/**
 * OTP detection.
 *
 * ADR 0003 requires this to be an explicit rule rather than an accident of what
 * the parsers happen to match. Reading all SMS means one-time codes land in the
 * pipeline automatically; they are worthless to Vivy a minute later and useful
 * to anyone studying how your bank approves payments.
 *
 * So this runs *first*, before any template, and a match means the message is
 * dropped entirely - not stored raw, not quarantined, not logged.
 *
 * Erring toward over-matching is correct here. A missed expense is a gap you can
 * fix from the statement; a retained OTP is a liability that never expires.
 */

const OTP_MARKERS = [
  /\botp\b/i,
  /\bone[\s-]?time\s*(?:password|passcode|pin|code)\b/i,
  /\bverification\s+code\b/i,
  /\bsecurity\s+code\b/i,
  /\bauth(?:entication)?\s+code\b/i,
  /\bdo\s*not\s*share\b/i,
  /\bnever\s+share\b/i,
  /\bvalid\s+for\s+\d+\s*(?:min|sec)/i,
  /\b\d{4,8}\s+is\s+your\b/i,
  /\bis\s+your\s+(?:otp|code|pin)\b/i,
];

export function isOtp(text: string): boolean {
  return OTP_MARKERS.some((pattern) => pattern.test(text));
}

/**
 * Other categories worth dropping before they reach a parser.
 *
 * These are messages that *look* transactional - they contain amounts and bank
 * names - but describe something that has not happened. Parsing them would
 * invent transactions, which is worse than missing real ones.
 */
const NOT_A_TRANSACTION = [
  /\bwill\s+be\s+(?:debited|deducted|charged)\b/i, // upcoming auto-debit notice
  /\bdue\s+(?:on|by|date)\b/i, // bill reminder
  /\brequest(?:ed|ing)?\s+(?:money|payment)\b/i, // collect request
  /\bhas\s+requested\b/i,
  /\bapply\s+now\b/i,
  /\boffer\b/i,
  /\bcashback\s+of\b/i,
  /\bpre[\s-]?approved\b/i,
  /\bdeclined\b/i,
  /\bfailed\b/i,
  /\breversed\b/i, // a reversal is real, but needs its own template - see TODO
];

export function isNonTransactional(text: string): boolean {
  return NOT_A_TRANSACTION.some((pattern) => pattern.test(text));
}

export type DropReason = 'otp' | 'non-transactional';

/** Should this message never become a stored record? */
export function shouldDrop(text: string): DropReason | null {
  if (isOtp(text)) return 'otp';
  if (isNonTransactional(text)) return 'non-transactional';
  return null;
}
