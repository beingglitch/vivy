/**
 * @vivy/money - turning scruffy bank messages into a ledger you can trust.
 *
 * Two halves that only make sense together. The SMS parser produces a real-time
 * stream of *deltas* that is fast but lossy; reconciliation compares those
 * against authoritative *snapshots* from statements and broker APIs, and
 * reports the gap instead of absorbing it.
 *
 * Runs wherever the stream key lives, not on the server: `android.sms` is a
 * sealed source, so the cloud holds ciphertext it cannot parse. See ADR 0004.
 */

export * from './sms/amount';
export * from './sms/otp';
export * from './sms/templates';
export * from './sms/parse';
export * from './ledger/reconcile';
