# ADR 0003. Money is read from derived sources; no credential is ever stored

- **Status:** accepted
- **Date:** 2026-09-05

## Context

Net worth is the number this product exists to move, and it has to update without
manual data entry. In India there are three routes.

**Account Aggregator** is the architecturally correct one: RBI-supervised,
consent-based, revocable, covering deposits, FDs, equities, mutual funds and NPS
through one interface. It is closed to us. Data flows to a *Financial Information
User*, and an FIU must be a regulated financial entity; the aggregators
themselves are NBFCs requiring ₹2 crore of net owned funds. An individual cannot
register as either.

**Net banking automation**, storing credentials so a script can log in, is
available to anyone and is the wrong answer. It violates bank terms, breaks on
every UI change, triggers fraud lockouts, and converts a data leak into a
money-movement incident.

## Decision

Read-only derived sources only. Nothing in this system authenticates to a bank.

| Signal              | Source                                    |
| ------------------- | ----------------------------------------- |
| UPI and card spend  | Bank SMS + payment app notifications      |
| Savings balance     | "Avl Bal" quoted in the same SMS          |
| Card outstanding    | Monthly statement email (Gmail API)       |
| Stock holdings      | Kite Connect holdings endpoint (free)     |
| Stock prices        | NSE end-of-day bhavcopy (free)            |
| Mutual funds, demat | Monthly CDSL/NSDL CAS email + AMFI NAVs   |
| FDs, informal debts | Manual, via chat or voice                 |

Deltas from SMS are real-time but drift; statements are authoritative but stale.
Both are stored, and the reconciler reports the gap rather than absorbing it, see `balance_snapshots` and the `confidence` column on `txns`.

## Consequences

- SMS templates change without notice, so parsers will break. Survivable because
  the raw string is stored (ADR 0005), every parse carries a confidence score, and
  the monthly statement catches what was missed.
- `READ_SMS` is forbidden by Google Play outside a default SMS handler. Irrelevant
  while sideloading; a hard wall if Vivy is ever distributed.
- iOS has no SMS access at all. The Pixel remains the money collector regardless
  of what other devices appear later.

## Never stored

Net banking or broker passwords; UPI PIN; card CVV or full card number; OTPs
(which arrive by SMS and must be dropped by an explicit rule, not by accident).
Statement PDF passwords live in the OS keychain, never the database.

If a feature appears to require one of these, that is evidence the feature is
wrong, not that this rule should bend.
