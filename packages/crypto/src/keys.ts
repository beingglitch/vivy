import { argon2id } from '@noble/hashes/argon2';
import { randomBytes } from '@noble/hashes/utils';

/**
 * The key hierarchy from ADR 0004.
 *
 *   passphrase --argon2id--> master key
 *   master key --wraps-----> one data key per sealed stream
 *   data key   --encrypts--> raw bodies
 *
 * The middle layer is what makes the scheme survivable in practice. Changing the
 * passphrase re-encrypts three small keys rather than every row ever captured,
 * and a leaked stream key exposes one category instead of a life.
 *
 * Pure JS on purpose. The same code has to run in Node, in a browser worker, and
 * eventually be mirrored on Android; a native module would rule out two of those
 * and complicate CI for no security gain.
 */

export const KEY_BYTES = 32; // AES-256
export const SALT_BYTES = 16;

/**
 * Argon2id parameters.
 *
 * Tuned for a device unlocking its own store, not a server checking thousands of
 * logins: ~64 MB and 3 passes costs a fraction of a second here and makes
 * offline guessing brutally expensive. Raising `m` is worth more than raising
 * `t` against GPU attackers, which is the whole reason to prefer argon2id over
 * PBKDF2.
 */
export const KDF_PARAMS = { t: 3, m: 65536, p: 4, dkLen: KEY_BYTES } as const;

export type Key = Uint8Array;

export function generateSalt(): Uint8Array {
  return randomBytes(SALT_BYTES);
}

/** A fresh random data key for one stream. */
export function generateKey(): Key {
  return randomBytes(KEY_BYTES);
}

/**
 * Domain separation.
 *
 * One passphrase serves two purposes: proving who you are to the server, and
 * unlocking sealed data on the device. Those outputs must never be equal, the
 * server stores the auth value, so if it were also the encryption key, a
 * database dump would decrypt everything the sealing was meant to protect.
 *
 * Prefixing the passphrase before the KDF makes the two derivations
 * cryptographically unrelated while keeping a single thing to remember.
 */
const AUTH_CONTEXT = 'vivy-auth:v1:';
const SEAL_CONTEXT = 'vivy-seal:v1:';

function assertUsable(passphrase: string, salt: Uint8Array): void {
  if (passphrase.length < 8) {
    throw new Error('passphrase must be at least 8 characters');
  }
  if (salt.length !== SALT_BYTES) {
    throw new Error(`salt must be ${SALT_BYTES} bytes`);
  }
}

/**
 * Derive the master key that unlocks sealed streams. Never leaves the device.
 *
 * Deliberately synchronous and slow. If this ever feels fast enough to call in a
 * loop, the parameters are wrong.
 */
export function deriveMasterKey(passphrase: string, salt: Uint8Array): Key {
  assertUsable(passphrase, salt);
  return argon2id(SEAL_CONTEXT + passphrase, salt, KDF_PARAMS);
}

/**
 * Derive the value the server stores to check a login.
 *
 * Safe to persist: it reveals nothing about the sealing key, because the two
 * derivations use different domain prefixes.
 */
export function deriveAuthHash(passphrase: string, salt: Uint8Array): Key {
  assertUsable(passphrase, salt);
  return argon2id(AUTH_CONTEXT + passphrase, salt, KDF_PARAMS);
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Recovery codes.
 *
 * A second path to the master key that does not depend on remembering anything.
 * Printed once at setup: without it, losing every device makes sealed history
 * unrecoverable - and people discover that at exactly the wrong moment.
 *
 * Grouped in fives purely so it can be read off paper without losing your place.
 */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(20); // 160 bits
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return (hex.toUpperCase().match(/.{1,5}/g) ?? []).join('-');
}

export function masterKeyFromRecoveryCode(code: string, salt: Uint8Array): Key {
  const normalised = code.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (normalised.length !== 40) {
    throw new Error('recovery code must contain 40 hex characters');
  }
  return argon2id(normalised, salt, KDF_PARAMS);
}
