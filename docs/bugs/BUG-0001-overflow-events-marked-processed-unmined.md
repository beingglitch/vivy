---
id: BUG-0001
title: Events over the per-run caps were marked processed without AI (silent data loss)
status: resolved
severity: high
ai_generated: yes
found: 2026-07-13
resolved: 2026-07-13
spec: [[SPEC-0001]]
commit:
created: 2026-07-13
---

# BUG-0001: Events over the per-run caps were marked processed without AI

## Symptom
In `processEvents` (lib/ai/process-events.ts) each run only mines the first `max`
text events (default 25) and the first 60 video watches. Any unprocessed text or
video events beyond those caps were flagged `processed: true` **without** task
extraction or category classification. Because the loop only re-selects
`processed: false` rows, those events were never looked at again — tasks silently
never proposed, videos stuck as "not yet classified" forever.

Reachable in normal use: `POST /api/events` accepts batches of 1–500, so one
browser-extension push of >60 video watches (or a backlog of >25 notes) drops the
overflow. Demonstrated: 30 notes + 70 videos + 5 page-visits in one run → OLD
marks 20 events processed-without-AI, of which 15 are unmined text/video (lost);
NEW marks only the 5 real analytics events.

## Root cause
`restIds` (the set marked processed-without-AI) was computed as "pending events
NOT in the *sliced* `textEvents`/`videoEvents` arrays." The slice caps them, so
overflow events are absent from those arrays and therefore fell into `restIds` —
conflating "analytics, needs no AI" with "minable, but over the cap this run."

## How it was introduced
Agent-written with the processing loop (SPEC-0001, 2026-07-08). The `.includes`
check against the post-`slice()` arrays looked correct but silently coupled the
"rest" set to the caps.

## Fix
`restIds` now selects events that are neither a minable text type nor a
`video.watch` at all — independent of the caps. Overflow stays `processed: false`
and is handled by the next run. `lib/ai/process-events.ts:103-110`.

## Prevention
- The "needs no AI" set is now defined by type (`!isText(e) && type !== 'video.watch'`),
  never by a capped slice — so raising/lowering a cap can't change what gets dropped.
- Regression check (standalone): overflow text/video must remain pending, and
  `restIds` must contain only genuine analytics types.
