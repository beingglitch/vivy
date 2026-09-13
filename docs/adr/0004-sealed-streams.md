# ADR 0004. Seal the detail, leave the aggregates readable

- **Status:** accepted
- **Date:** 2026-09-05

## Context

Full accessibility capture on Android means the raw stream contains on-screen
text from every allowlisted app, and the SMS stream contains transaction detail.
Both are durable in the cloud. Encrypting everything is the obvious instinct, and it would quietly destroy the
assistant, because the nightly brief has to read *something*.

## Decision

Encrypt per stream, client-side, before upload:

- **Sealed:** `android.a11y`, `android.sms`, `server.gmail`, raw bodies become
  `{ ct, iv }` under AES-256-GCM. The server stores ciphertext it cannot read.
- **Plaintext:** derived events, rollups, ledger aggregates. Timings and totals
  stay readable so the cloud model can say "food spend doubled this week".

Key hierarchy: a passphrase runs through Argon2id to a master key that never
leaves the device; the master key wraps one data key per sealed stream. Changing
the passphrase re-encrypts three small keys, not four million rows, and one leaked
key exposes one stream. A printed recovery code is the second path to the master
key.

Pairing carries the wrapped stream keys device-to-device via QR, so they never
transit the server in usable form.

## Consequences

- Sealed data can only be analysed on-device. This is not a limitation to work
  around, it is precisely the job of the Tier 1 local model.
- Metadata remains readable to anyone holding the database: that a transaction
  occurred at 14:02, that an app was used for 40 minutes. Accepted deliberately;
  hiding it would cost the assistant its usefulness.
- Losing every device with no recovery code means sealed history is gone. The
  recovery code is therefore part of setup, not an advanced setting.

## Alternatives considered

- **Encrypt nothing.** Simplest, and puts a continuous record of a life in
  plaintext on a third-party host.
- **Encrypt everything including aggregates.** Defensible, and reduces Vivy to a
  passive archive, no brief, no noticing, no reason to exist.
