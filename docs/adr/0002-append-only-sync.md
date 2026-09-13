# ADR 0002. Hand-rolled append-only sync, no CRDTs

- **Status:** accepted
- **Date:** 2026-09-05

## Context

Four devices write to one dataset. That normally means conflict resolution, and
the industry answer is a sync framework or a CRDT library.

But look at what is actually written. "An app came to the foreground at 14:02."
"A video played for 740 seconds." "₹400 left the account." These are *immutable
observations of the past*. No device edits another device's rows, because no
device was there to observe them. The conflict case does not arise.

## Decision

Two primitives:

- **Push**: a device sends a batch; every row carries a `dedupeKey` derived from
  the observation itself. The server inserts with `ON CONFLICT DO NOTHING`. Replay
  is therefore free, and a high duplicate count means the mechanism is working.
- **Pull**: the server assigns a monotonic `seq`; a device asks for everything
  after its cursor and stores the new high-water mark.

Cursors are a pair (`raw`, `events`) rather than one number, because re-deriving
events advances one sequence without touching the other.

The genuinely mutable rows (task status, settings, account metadata) are
human-speed and single-writer in practice. Last-write-wins on a field timestamp
is sufficient; you will not edit the same task on two devices in one second.

## Consequences

- The whole protocol is one file in `@vivy/core` and two route handlers.
- `dedupeKey` must be deterministic. A key built from `Date.now()` at send time
  silently disables the entire guarantee, so key construction lives in one helper
  and collectors are reviewed for it.
- If simultaneous editing of shared documents is ever added, this decision must be
  revisited rather than extended.

## Alternatives considered

- **ElectricSQL / PowerSync.** Good products. Priced in complexity for conflict
  machinery and partial-replication rules we would barely use, and the retention
  window with on-demand backfill is custom work either way. Kept as an escape
  hatch.
- **CRDTs (Automerge, cr-sqlite).** Solve simultaneous edits to shared state, a problem one person appending
  immutable facts does not have.
- **Turso embedded replicas.** Elegant symmetry, but full-replica by design, which
  fights the retention window from ADR 0001.
