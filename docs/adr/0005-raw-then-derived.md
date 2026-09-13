# ADR 0005. Collectors store what was observed, never what it means

- **Status:** accepted
- **Date:** 2026-09-05

## Context

Capture is the only irreversible part of this system. A chart can be redrawn, a
schema migrated, a model swapped, but a day that nothing recorded is gone. That
asymmetry should decide how much thinking a collector is allowed to do.

A collector that interprets is a collector that discards whatever it did not
think mattered. When a bank rewords its SMS template, an interpreting collector
drops transactions silently and the loss is permanent.

## Decision

Three layers, in dependency order:

1. **`raw_records`**, verbatim, append-only, never updated. The SMS string, the
   DOM scrape, the voice transcript, exactly as observed.
2. **`events`**, derived, and safe to drop and rebuild. Every row carries `rawId`
   (provenance) and `derivedBy` (parser version), so improving a parser tells you
   exactly which rows to recompute.
3. **`metrics_daily`**, the aggregate charts read, rebuilt nightly.

Classification never happens at capture time. A content script writes
`category: null` and lets the Tier 1 local model fill it in later, in batch, over
the whole archive.

## Consequences

- A parser fix is retroactive. Six months of misfiled transactions repair
  themselves on the next rebuild.
- Storage costs more, which is why the retention window (ADR 0001) applies to raw
  and the highest-volume stream stays local-only.
- Every derived value must be reconstructible from raw. A field that cannot be
  will not survive the next rebuild, so it does not belong in `events`.

## Alternatives considered

- **Parse at the edge, store only structured events.** Smaller and faster, and
  every parser bug becomes permanent data loss.
