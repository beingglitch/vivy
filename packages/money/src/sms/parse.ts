import { findAmount, toMinorUnits } from './amount';
import { shouldDrop, type DropReason } from './otp';
import {
  TEMPLATES,
  findBalanceRaw,
  guessDirection,
  guessMethod,
  type Direction,
  type Method,
} from './templates';

export const PARSER_VERSION = 'sms-parser@v1';

export interface ParsedTxn {
  amountMinor: number;
  direction: Direction;
  method: Method;
  accountRef: string | null;
  counterparty: string | null;
  balanceAfterMinor: number | null;
}

export type ParseOutcome =
  | { status: 'dropped'; reason: DropReason }
  | { status: 'parsed'; txn: ParsedTxn; templateId: string; confidence: number }
  | { status: 'unmatched'; reason: string };

/**
 * Tidy a merchant or VPA into something a category model and a human can both
 * read. Deliberately conservative: this is display text, and over-cleaning turns
 * two different merchants into one.
 */
export function normaliseCounterparty(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/, '')
    .trim();
  if (cleaned.length === 0 || cleaned.length > 64) return null;

  // `swiggy@ybl` -> `swiggy`. The handle identifies the PSP, not the merchant.
  const vpa = /^([\w.-]+)@[\w-]+$/.exec(cleaned);
  if (vpa?.[1]) return vpa[1].replace(/[._-]+/g, ' ').trim().toUpperCase();

  return cleaned.toUpperCase();
}

/**
 * Parse one SMS.
 *
 * Three outcomes, and the third is the one that matters most. A message nothing
 * recognises is *not* dropped - it is returned as `unmatched` so it lands in a
 * review queue. That is the difference between "my parser needs a new template"
 * and "my spending numbers are quietly wrong".
 *
 * The raw text is never mutated or stored by this function; it works on a copy
 * and returns structure. Provenance stays with the caller. See ADR 0005.
 */
export function parseSms(text: string): ParseOutcome {
  // ADR 0003: this runs before anything else, and a match means the message is
  // gone - not quarantined, not logged.
  const drop = shouldDrop(text);
  if (drop) return { status: 'dropped', reason: drop };

  for (const template of TEMPLATES) {
    const match = template.pattern.exec(text);
    if (!match?.groups) continue;

    const rawAmount = match.groups['amount'];
    if (!rawAmount) continue;

    let amountMinor: number;
    try {
      amountMinor = toMinorUnits(rawAmount);
    } catch {
      continue; // matched the shape but not a real amount - let a later template try
    }
    if (amountMinor <= 0) continue;

    const balanceRaw = findBalanceRaw(text);
    let balanceAfterMinor: number | null = null;
    if (balanceRaw) {
      try {
        balanceAfterMinor = toMinorUnits(balanceRaw);
      } catch {
        balanceAfterMinor = null;
      }
    }

    // A template may declare `unknown` and let the text decide.
    const method = template.method === 'unknown' ? guessMethod(text) : template.method;

    return {
      status: 'parsed',
      templateId: template.id,
      confidence: template.confidence,
      txn: {
        amountMinor,
        direction: template.direction,
        method,
        accountRef: match.groups['account'] ?? null,
        counterparty: normaliseCounterparty(match.groups['counterparty']),
        balanceAfterMinor,
      },
    };
  }

  // Fallback: enough signal to be worth recording, not enough to trust. Scored
  // low so the reconciler blames this window first when a balance drifts.
  const amountMinor = findAmount(text);
  const direction = guessDirection(text);
  if (amountMinor !== null && amountMinor > 0 && direction) {
    const balanceRaw = findBalanceRaw(text);
    return {
      status: 'parsed',
      templateId: 'fallback.heuristic',
      confidence: 0.45,
      txn: {
        amountMinor,
        direction,
        method: guessMethod(text),
        accountRef: /(?:[xX*]{2,}\s*)(\d{3,6})/.exec(text)?.[1] ?? null,
        counterparty: null,
        balanceAfterMinor: balanceRaw ? (findAmount(`Rs ${balanceRaw}`) ?? null) : null,
      },
    };
  }

  return {
    status: 'unmatched',
    reason: amountMinor === null ? 'no amount found' : 'no direction found',
  };
}
