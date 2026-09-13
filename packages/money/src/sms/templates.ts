import { AMOUNT_PATTERN } from './amount';

/**
 * The template registry.
 *
 * Indian banks each invent their own SMS wording and change it without notice,
 * so this is data rather than code: adding a bank is one entry, and a template
 * that stops matching is visible in the review queue rather than silently
 * dropping transactions.
 *
 * Templates are tried in order and the first match wins, so specific patterns
 * must sit above generic ones. Confidence encodes how much of the message the
 * pattern actually pinned down - it is what the reconciler uses to decide which
 * window to blame when a balance drifts.
 *
 * Adding your bank: capture `amount` always, plus whichever of `account`,
 * `counterparty` and `balance` the message contains. Nothing else is read.
 */

export type Direction = 'debit' | 'credit';
export type Method = 'upi' | 'card' | 'netbanking' | 'cash' | 'auto-debit' | 'transfer' | 'unknown';

export interface SmsTemplate {
  readonly id: string;
  readonly issuer: string;
  readonly direction: Direction;
  readonly method: Method;
  readonly pattern: RegExp;
  /** 0-1. Specific bank wording scores high; shape-only matches score lower. */
  readonly confidence: number;
}

const A = AMOUNT_PATTERN;

/** Masked account tails: `XX4321`, `x4321`, `**4321`, `A/c no. 4321`. */
const ACCT = String.raw`(?:[xX*]{1,6}\s*)?(?<account>\d{3,6})`;

export const TEMPLATES: readonly SmsTemplate[] = [
  // ---- specific bank wording ------------------------------------------------
  {
    // "Dear UPI user A/C X4321 debited by 400.0 on date 05Sep26 trf to SWIGGY Refno 1234"
    id: 'sbi.upi.debit',
    issuer: 'SBI',
    direction: 'debit',
    method: 'upi',
    pattern: new RegExp(
      String.raw`A\/C\s*${ACCT}\s+debited\s+by\s+(?<amount>[\d,]+(?:\.\d{1,2})?)\s+on\s+date\s+\S+\s+trf\s+to\s+(?<counterparty>.+?)\s+Ref`,
      'i',
    ),
    confidence: 0.95,
  },
  {
    // "Your A/c XX4321 is credited by Rs.5000 on 05-09-26 by a/c linked to VPA rahul@ybl"
    id: 'sbi.upi.credit',
    issuer: 'SBI',
    direction: 'credit',
    method: 'upi',
    pattern: new RegExp(
      String.raw`A\/[Cc]\s*${ACCT}\s+(?:is\s+)?credited\s+(?:by|with)\s+${A}.*?VPA\s+(?<counterparty>[\w.@-]+)`,
      'i',
    ),
    confidence: 0.95,
  },
  {
    // "Rs.1200.00 spent on HDFC Bank Card x4321 at SWIGGY on 2026-09-05"
    id: 'card.spent.at',
    issuer: 'generic-card',
    direction: 'debit',
    method: 'card',
    pattern: new RegExp(
      String.raw`${A}\s+spent\s+(?:on|using)\s+(?:your\s+)?.*?card\s*${ACCT}\s+at\s+(?<counterparty>.+?)(?:\s+on\s|\.|$)`,
      'i',
    ),
    confidence: 0.93,
  },
  {
    // OneCard / fintech cards: "Rs 1200 spent on your OneCard at SWIGGY"
    id: 'card.spent.noacct',
    issuer: 'generic-card',
    direction: 'debit',
    method: 'card',
    pattern: new RegExp(
      String.raw`${A}\s+spent\s+(?:on|using)\s+(?:your\s+)?(?<issuer>[\w ]*card)\s+at\s+(?<counterparty>.+?)(?:\s+on\s|\.|$)`,
      'i',
    ),
    confidence: 0.85,
  },

  // ---- generic shapes, most specific first ---------------------------------
  {
    // "Rs.400.00 debited from A/c XX4321 ... to VPA swiggy@ybl"
    id: 'generic.debit.vpa',
    issuer: 'generic',
    direction: 'debit',
    method: 'upi',
    pattern: new RegExp(
      String.raw`${A}\s+(?:has\s+been\s+)?debited\s+from\s+(?:your\s+)?(?:bank\s+)?A\/?c(?:count)?\.?\s*(?:no\.?\s*)?${ACCT}.*?VPA\s+(?<counterparty>[\w.@-]+)`,
      'i',
    ),
    confidence: 0.9,
  },
  {
    // "ICICI Bank Acct XX321 debited for Rs 400.00 on 05-Sep-26; swiggy credited"
    id: 'generic.acct.debited.for',
    issuer: 'generic',
    direction: 'debit',
    method: 'unknown',
    pattern: new RegExp(
      String.raw`A(?:cct|ccount|\/c)\.?\s*(?:no\.?\s*)?${ACCT}\s+debited\s+for\s+${A}(?:.*?;\s*(?<counterparty>[^;.]+?)\s+credited)?`,
      'i',
    ),
    confidence: 0.88,
  },
  {
    id: 'generic.debit.account',
    issuer: 'generic',
    direction: 'debit',
    method: 'unknown',
    pattern: new RegExp(
      String.raw`${A}\s+(?:has\s+been\s+)?debited\s+from\s+(?:your\s+)?(?:bank\s+)?A\/?c(?:count)?\.?\s*(?:no\.?\s*)?${ACCT}`,
      'i',
    ),
    confidence: 0.8,
  },
  {
    id: 'generic.credit.account',
    issuer: 'generic',
    direction: 'credit',
    method: 'unknown',
    pattern: new RegExp(
      String.raw`${A}\s+(?:has\s+been\s+)?credited\s+(?:to\s+)?(?:your\s+)?(?:bank\s+)?A\/?c(?:count)?\.?\s*(?:no\.?\s*)?${ACCT}`,
      'i',
    ),
    confidence: 0.8,
  },
  {
    // "INR 400.00 debited A/c no. XX4321 05-09-26 UPI/P2M/123456/SWIGGY"
    id: 'generic.debit.upiref',
    issuer: 'generic',
    direction: 'debit',
    method: 'upi',
    pattern: new RegExp(
      String.raw`${A}\s+debited\s+A\/?c\.?\s*(?:no\.?\s*)?${ACCT}.*?UPI\/[^/]*\/[^/]*\/(?<counterparty>[^\s.]+)`,
      'i',
    ),
    confidence: 0.87,
  },
] as const;

/**
 * Running balance, extracted separately.
 *
 * Nearly every Indian bank appends it in some form, and it is the single most
 * valuable field in the message - a free authoritative-ish balance on every
 * transaction. Pulling it out independently means one pattern serves every
 * template instead of each having to repeat it.
 */
const BALANCE_PATTERNS = [
  new RegExp(String.raw`(?:avl|available|avail)\.?\s*(?:bal|balance)\.?\s*(?:is)?\s*:?\s*${A}`, 'i'),
  new RegExp(String.raw`(?:bal|balance)\.?\s*(?:is)?\s*:?\s*${A}`, 'i'),
];

export function findBalanceRaw(text: string): string | null {
  for (const pattern of BALANCE_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1];
  }
  return null;
}

/** Coarse direction guess, used only by the low-confidence fallback. */
export function guessDirection(text: string): Direction | null {
  if (/\b(debited|spent|withdrawn|paid|purchase)\b/i.test(text)) return 'debit';
  if (/\b(credited|received|deposited|refund)\b/i.test(text)) return 'credit';
  return null;
}

export function guessMethod(text: string): Method {
  if (/\bupi\b|\bvpa\b|@[\w-]+/i.test(text)) return 'upi';
  if (/\bcard\b|\bpos\b/i.test(text)) return 'card';
  if (/\bneft\b|\bimps\b|\brtgs\b|\btransfer\b/i.test(text)) return 'transfer';
  if (/\bach\b|\bmandate\b|\bauto[\s-]?debit\b|\benach\b/i.test(text)) return 'auto-debit';
  if (/\batm\b|\bcash\b/i.test(text)) return 'cash';
  return 'unknown';
}
