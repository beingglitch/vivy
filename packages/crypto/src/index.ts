/**
 * @vivy/crypto - client-side sealing for the streams that must not sit in
 * plaintext on someone else's disk.
 *
 * Scope note: this package protects *raw bodies*. Aggregates, rollups and the
 * derived ledger stay readable on purpose, because the nightly brief has to
 * reason over them. Encrypting everything would be simpler and would quietly
 * remove the reason Vivy exists. See ADR 0004.
 */

export * from './keys';
export * from './seal';
