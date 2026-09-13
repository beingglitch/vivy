import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/hashes/utils';
import type { Key } from './keys';

/**
 * Sealing: encrypt a raw body on the device before it is uploaded.
 *
 * AES-256-GCM, which authenticates as well as encrypts - a tampered record fails
 * to open rather than decrypting into plausible nonsense. That matters more than
 * usual here, because the thing being protected is a financial ledger.
 *
 * The envelope is versioned from day one. Rotating an algorithm across years of
 * stored records is only possible if every record says which one it used.
 */

export const SEAL_VERSION = 1;
const NONCE_BYTES = 12; // GCM standard; do not change without bumping SEAL_VERSION

export interface SealedBody {
  v: number;
  /** base64 ciphertext, including the GCM tag. */
  ct: string;
  /** base64 nonce. Unique per record - never reused with the same key. */
  iv: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

export function isSealedBody(value: unknown): value is SealedBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ct' in value &&
    'iv' in value &&
    typeof (value as SealedBody).ct === 'string'
  );
}

/**
 * Seal a body.
 *
 * A fresh nonce per record is not optional: reusing one with the same key breaks
 * GCM catastrophically, leaking plaintext rather than merely weakening it.
 */
export function seal(key: Key, body: unknown): SealedBody {
  const nonce = randomBytes(NONCE_BYTES);
  const plaintext = encoder.encode(JSON.stringify(body));
  const ciphertext = gcm(key, nonce).encrypt(plaintext);
  return { v: SEAL_VERSION, ct: toBase64(ciphertext), iv: toBase64(nonce) };
}

/** Open a sealed body. Throws if the key is wrong or the record was altered. */
export function unseal<T = unknown>(key: Key, sealed: SealedBody): T {
  if (sealed.v !== SEAL_VERSION) {
    throw new Error(`unsupported seal version ${sealed.v}`);
  }
  const plaintext = gcm(key, fromBase64(sealed.iv)).decrypt(fromBase64(sealed.ct));
  return JSON.parse(decoder.decode(plaintext)) as T;
}

/**
 * Wrap a stream key under the master key so it can be stored or handed to a new
 * device during pairing. Same primitive, different payload - one implementation
 * to review rather than two.
 */
export function wrapKey(master: Key, streamKey: Key): SealedBody {
  return seal(master, Array.from(streamKey));
}

export function unwrapKey(master: Key, wrapped: SealedBody): Key {
  const bytes = unseal<number[]>(master, wrapped);
  if (!Array.isArray(bytes) || bytes.length !== 32) {
    throw new Error('unwrapped value is not a 32-byte key');
  }
  return new Uint8Array(bytes);
}
