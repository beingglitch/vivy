/**
 * Amount parsing.
 *
 * Everything downstream is integer paise. Rupees as a float drift, and a ledger
 * that disagrees with itself by a rounding error is worse than no ledger at all.
 *
 * The hard part is Indian digit grouping: `1,23,456.78` is one lakh twenty-three
 * thousand, not a malformed `1.23`. Stripping separators before parsing handles
 * both that and the Western grouping banks sometimes use in the same message.
 */

/**
 * The capture must be *named*, because `parseSms` reads `match.groups.amount`.
 * An unnamed group here silently makes every template that embeds it fail to
 * yield an amount, so each one falls through to the low-confidence heuristic and
 * quietly loses its counterparty. Only embed this once per regex - two groups of
 * the same name in one pattern is a syntax error.
 */
const AMOUNT = String.raw`(?:rs\.?|inr|₹)\s*(?<amount>[\d,]+(?:\.\d{1,2})?)`;

export const AMOUNT_PATTERN = AMOUNT;

/** `"1,23,456.78"` -> `12345678`. Throws on anything it cannot read exactly. */
export function toMinorUnits(raw: string): number {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new TypeError(`unparseable amount: ${raw}`);
  }

  const [whole = '0', fraction = ''] = cleaned.split('.');
  const paise = fraction.padEnd(2, '0').slice(0, 2);

  // Built by string concatenation rather than `value * 100`, because
  // 19.99 * 100 is 1998.9999999999998 in binary floating point.
  return Number(`${whole}${paise}`);
}

export function formatMinor(minor: number, currency = 'INR'): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const rupees = Math.floor(abs / 100);
  const paise = String(abs % 100).padStart(2, '0');
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${sign}${symbol}${rupees.toLocaleString('en-IN')}.${paise}`;
}

/** First amount in a message, or null. Used by the generic fallback parser. */
export function findAmount(text: string): number | null {
  const match = new RegExp(AMOUNT, 'i').exec(text);
  if (!match?.[1]) return null;
  try {
    return toMinorUnits(match[1]);
  } catch {
    return null;
  }
}
