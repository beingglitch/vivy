/**
 * Invite code format.
 *
 * Lives in core, with no dependencies, because two things must agree on it
 * exactly: the web app that mints codes and the command-line escape hatch used
 * when nobody can sign in. Two copies of this would drift, and the failure would
 * be a code that looks right and never validates.
 *
 * Hashing is deliberately *not* here, it needs a crypto implementation, and
 * each consumer already has one. Only the encoding is shared.
 */

/** Crockford base32: no I, L, O or U, so a code survives being read aloud. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** `VIVY-XXXXX-XXXXX-...`, grouped so it can be typed without losing your place. */
export function formatInviteCode(raw: string): string {
  return `VIVY-${(raw.match(/.{1,5}/g) ?? []).join('-')}`;
}

/**
 * Strip formatting so `vivy-abc de` and `ABCDE` compare equal.
 *
 * The character substitutions follow Crockford: O reads as zero, I and L as one,
 * U as V. A code copied by hand with the wrong lookalike still works, which
 * matters when someone is reading it off a phone screen.
 */
export function canonicalInviteCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/^VIVY-?/, '')
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
}

/** 16 random bytes encode to 26 characters. Anything shorter is not one of ours. */
export const INVITE_CODE_MIN_LENGTH = 20;
