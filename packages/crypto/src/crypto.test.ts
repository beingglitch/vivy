import { describe, expect, it } from 'vitest';
import {
  deriveMasterKey,
  generateKey,
  generateRecoveryCode,
  generateSalt,
  masterKeyFromRecoveryCode,
} from './keys';
import { isSealedBody, seal, unseal, unwrapKey, wrapKey } from './seal';

// Argon2id at the real parameters is deliberately slow, so the tests that
// exercise it get a longer budget rather than weaker settings - measuring the
// shipped configuration is the point.
const KDF_TIMEOUT = 30_000;

describe('seal / unseal', () => {
  const key = generateKey();

  it('round-trips a body', () => {
    const body = { text: 'Rs.400.00 debited from A/c XX4321', from: 'SBIUPI' };
    const sealed = seal(key, body);
    expect(unseal(key, sealed)).toEqual(body);
  });

  it('produces ciphertext that does not contain the plaintext', () => {
    const sealed = seal(key, { text: 'SWIGGY' });
    expect(sealed.ct).not.toContain('SWIGGY');
    expect(Buffer.from(sealed.ct, 'base64').toString('utf8')).not.toContain('SWIGGY');
  });

  it('uses a fresh nonce every time', () => {
    // Nonce reuse under one key breaks GCM catastrophically, so this is a
    // correctness test, not a style one.
    const a = seal(key, { n: 1 });
    const b = seal(key, { n: 1 });
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('refuses a wrong key', () => {
    const sealed = seal(key, { secret: true });
    expect(() => unseal(generateKey(), sealed)).toThrow();
  });

  it('detects tampering rather than decrypting to nonsense', () => {
    const sealed = seal(key, { amount: 400 });
    const bytes = Buffer.from(sealed.ct, 'base64');
    bytes[0] = (bytes[0]! ^ 0xff) & 0xff;
    expect(() => unseal(key, { ...sealed, ct: bytes.toString('base64') })).toThrow();
  });

  it('rejects an unknown envelope version', () => {
    const sealed = seal(key, { a: 1 });
    expect(() => unseal(key, { ...sealed, v: 99 })).toThrow(/unsupported seal version/);
  });

  it('recognises a sealed body', () => {
    expect(isSealedBody(seal(key, { a: 1 }))).toBe(true);
    expect(isSealedBody({ text: 'plain' })).toBe(false);
    expect(isSealedBody(null)).toBe(false);
  });
});

describe('key wrapping', () => {
  it('round-trips a stream key under a master key', () => {
    const master = generateKey();
    const streamKey = generateKey();
    const unwrapped = unwrapKey(master, wrapKey(master, streamKey));
    expect(Array.from(unwrapped)).toEqual(Array.from(streamKey));
  });

  it('keeps streams independent - one leaked key opens only its own', () => {
    const master = generateKey();
    const moneyKey = generateKey();
    const screenKey = generateKey();

    const moneyRecord = seal(moneyKey, { amount: 40000 });
    expect(() => unseal(screenKey, moneyRecord)).toThrow();
    expect(unseal(moneyKey, moneyRecord)).toEqual({ amount: 40000 });

    // And the master still opens both wrappers.
    expect(Array.from(unwrapKey(master, wrapKey(master, screenKey)))).toEqual(
      Array.from(screenKey),
    );
  });
});

describe('deriveMasterKey', () => {
  it(
    'is deterministic for the same passphrase and salt',
    () => {
      const salt = generateSalt();
      const a = deriveMasterKey('correct horse battery', salt);
      const b = deriveMasterKey('correct horse battery', salt);
      expect(Array.from(a)).toEqual(Array.from(b));
      expect(a).toHaveLength(32);
    },
    KDF_TIMEOUT,
  );

  it(
    'differs across salts, so two users with one passphrase differ',
    () => {
      const a = deriveMasterKey('correct horse battery', generateSalt());
      const b = deriveMasterKey('correct horse battery', generateSalt());
      expect(Array.from(a)).not.toEqual(Array.from(b));
    },
    KDF_TIMEOUT,
  );

  it('rejects a short passphrase', () => {
    expect(() => deriveMasterKey('short', generateSalt())).toThrow(/at least 8/);
  });

  it('rejects a wrong-sized salt', () => {
    expect(() => deriveMasterKey('long enough passphrase', new Uint8Array(4))).toThrow(/salt/);
  });
});

describe('recovery code', () => {
  it('is 40 hex characters in readable groups', () => {
    const code = generateRecoveryCode();
    expect(code.replace(/-/g, '')).toMatch(/^[0-9A-F]{40}$/);
    expect(code).toContain('-');
  });

  it(
    'reaches the same key regardless of formatting',
    () => {
      const salt = generateSalt();
      const code = generateRecoveryCode();
      const spaced = code.replace(/-/g, ' ').toLowerCase();
      expect(Array.from(masterKeyFromRecoveryCode(code, salt))).toEqual(
        Array.from(masterKeyFromRecoveryCode(spaced, salt)),
      );
    },
    KDF_TIMEOUT,
  );

  it('rejects a truncated code', () => {
    expect(() => masterKeyFromRecoveryCode('ABC-DEF', generateSalt())).toThrow(/40 hex/);
  });
});
