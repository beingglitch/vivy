# ADR 0001. The device is the source of truth, not the cloud

- **Status:** accepted
- **Date:** 2026-09-05

## Context

Vivy has to work on a phone with no signal and a laptop that sleeps. It also has
to show a year of history on a device that cannot hold a year of raw capture.
Those two requirements pull in opposite directions, and the usual answer, server-first with a cache, fails the first one: every screen ends up gated on a
request that may never complete.

## Decision

The UI reads the local database, always. It never issues a request to render.
A background sync keeps that database fed.

The local store is sized by a split, not a single window:

| Data          | Kept locally           | Why                                                    |
| ------------- | ---------------------- | ------------------------------------------------------ |
| `raw_records` | N days (setting)       | Large, rarely re-read once derived                     |
| `events`      | N days (setting)       | Large, drill-down only                                 |
| `metrics_daily` | **all time**         | ~100 bytes per stream per day, years fit in megabytes |
| money ledger  | **all time**           | Small, and the thing looked at most                    |

Because rollups are never evicted, every chart on the home canvas renders offline
across full history. Only drilling into a specific old day needs the network, and
that path is an explicit backfill request.

## Consequences

- Retrofitting this later would be a rewrite, so it lands in P1 rather than after
  the UI. Local-first is a shape, not a feature.
- Four local stores (Android, daemon, extension, PWA) must agree on schema, which
  is why `@vivy/core` generates it rather than each re-declaring it.
- An outage in Vercel or Neon is invisible while using the app. Only new data from
  *other* devices stops arriving.

## Alternatives considered

- **Server-first with an HTTP cache.** Simplest, and fails the plane test.
- **Full local replica of everything.** No retention window to implement, but the
  phone would carry gigabytes of screen text it will never read.
