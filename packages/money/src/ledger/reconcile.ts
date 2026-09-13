/**
 * Reconciliation.
 *
 * SMS gives a stream of *changes*; statements give occasional *truths*. Neither
 * alone is enough - deltas drift silently when a message is delayed, filtered or
 * never sent, and statements are a month stale.
 *
 * So both are stored and compared. When the accumulated deltas between two
 * authoritative snapshots disagree with the snapshots themselves, that gap is
 * reported rather than absorbed: a known, quantified discrepancy is a solved
 * problem, where a slowly-rotting number is not.
 */

export interface LedgerTxn {
  id: string;
  accountId: string;
  localDate: string;
  amountMinor: number;
  direction: 'debit' | 'credit';
  confidence: number;
}

export interface Snapshot {
  accountId: string;
  asOf: string;
  balanceMinor: number;
  authority: 'statement' | 'broker-api' | 'cas' | 'manual' | 'sms-inferred';
}

export interface Drift {
  accountId: string;
  from: string;
  to: string;
  openingMinor: number;
  closingMinor: number;
  /** What the transactions in the window add up to. */
  observedDeltaMinor: number;
  /** What they should have added up to. */
  expectedDeltaMinor: number;
  driftMinor: number;
  txnCount: number;
  /** Lowest-confidence transaction in the window - where to look first. */
  weakestConfidence: number;
}

/** Only these are trusted to anchor a window. `sms-inferred` is a hint, not truth. */
const AUTHORITATIVE = new Set(['statement', 'broker-api', 'cas', 'manual']);

export function signedMinor(txn: Pick<LedgerTxn, 'amountMinor' | 'direction'>): number {
  return txn.direction === 'credit' ? txn.amountMinor : -txn.amountMinor;
}

/**
 * Compare consecutive authoritative snapshots against the transactions between
 * them. One `Drift` per window; a zero `driftMinor` means the window is clean.
 */
export function reconcile(txns: readonly LedgerTxn[], snapshots: readonly Snapshot[]): Drift[] {
  const anchors = snapshots
    .filter((s) => AUTHORITATIVE.has(s.authority))
    .slice()
    .sort((a, b) => a.asOf.localeCompare(b.asOf));

  const drifts: Drift[] = [];

  for (let i = 0; i + 1 < anchors.length; i++) {
    const opening = anchors[i];
    const closing = anchors[i + 1];
    if (!opening || !closing) continue;
    if (opening.accountId !== closing.accountId) continue;

    // Half-open window: a transaction dated on the opening snapshot is already
    // reflected in it, one dated on the closing snapshot is not yet.
    const inWindow = txns.filter(
      (t) =>
        t.accountId === opening.accountId &&
        t.localDate > opening.asOf &&
        t.localDate <= closing.asOf,
    );

    const observedDeltaMinor = inWindow.reduce((sum, t) => sum + signedMinor(t), 0);
    const expectedDeltaMinor = closing.balanceMinor - opening.balanceMinor;

    drifts.push({
      accountId: opening.accountId,
      from: opening.asOf,
      to: closing.asOf,
      openingMinor: opening.balanceMinor,
      closingMinor: closing.balanceMinor,
      observedDeltaMinor,
      expectedDeltaMinor,
      driftMinor: expectedDeltaMinor - observedDeltaMinor,
      txnCount: inWindow.length,
      weakestConfidence: inWindow.reduce((min, t) => Math.min(min, t.confidence), 1),
    });
  }

  return drifts;
}

/**
 * Windows worth asking the user about.
 *
 * A drift under a rupee is rounding somewhere and not worth a notification;
 * anything larger is a real missing or duplicated transaction. Sorted by size,
 * because the biggest gap is the one most likely to be a single missed message.
 */
export function materialDrifts(drifts: readonly Drift[], thresholdMinor = 100): Drift[] {
  return drifts
    .filter((d) => Math.abs(d.driftMinor) >= thresholdMinor)
    .sort((a, b) => Math.abs(b.driftMinor) - Math.abs(a.driftMinor));
}
