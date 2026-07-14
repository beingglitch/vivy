---
id: SPEC-0010
title: Goals + nightly planner (goal-aware day optimization, Google Calendar OAuth)
status: building
created: 2026-07-14
---

# SPEC-0010: Goals + nightly planner

## What & why

Suraj: "we need to set goals — earning liquid 1 million in 2 years, health goals,
reading goals… AI should tell me based on goals how I should optimize my day. Before
sleeping I tell Vivy what I want tomorrow; she checks what's already scheduled and
schedules the rest."

Goals are the top of the pyramid (goals → areas/projects → tasks/routines). Per the
automation rule, **goal progress is computed from the timeline, never typed in**:
money goals read net worth from finance, reading goals read learning sessions. The
planner closes the daily loop: evening intent → tomorrow's time-blocked plan →
morning brief opens with it.

His calls (2026-07-14): calendar = **full Google OAuth** (read AND write — Vivy can
place blocks on the real calendar); goals+planner before voice/health capture
(that's SPEC-0011).

## Acceptance criteria

- [x] `goals` table + /goals page: create/edit/drop a goal with kind
      (money/reading/health/custom), auto-metric, target, deadline. Progress and
      required-pace ("need +₹X/month") computed from existing data — no manual
      progress field anywhere. (Verified: test money goal auto-baselined at his
      real net worth −₹67,197 and computed "needs +₹44k/month".)
- [x] Home shows active goals with pace bars (on pace / behind, with numbers).
- [x] Google OAuth connect flow built: /settings "Connect Google Calendar" →
      consent → refresh token stored server-side; disconnect button; redirect URI
      derived from request origin (register localhost + prod).
      **Live connect blocked on user step: GOOGLE_CLIENT_ID/SECRET.**
- [ ] Planner reads tomorrow's real calendar events — code done (live query),
      needs the OAuth connect above to verify against his real calendar.
- [x] /plan page: shows tomorrow's fixed events + routines due + deadline tasks +
      goals behind pace; free-text "what do you want tomorrow" → Claude produces a
      time-blocked plan; saved per-day (rerun replaces). (Verified end-to-end
      locally: real plan generated with sane blocks, meal gaps, football coach
      note; test plan deleted after.)
- [ ] "Put blocks on my calendar" button → creates the plan's blocks as real
      Google Calendar events (marked `[vivy]` so re-planning can replace them).
      Code done; needs OAuth connect to verify.
- [x] Evening nudge (21:30 IST) links to /plan; morning brief includes last
      night's plan and goal pace.
- [ ] Verified with his real Google account + at least one real goal set by him.

## Out of scope

- Meal/sleep events, mic button, Android tile, MCP log tools → SPEC-0011.
- Health goal auto-metrics (need sleep/meal events first — the health goal kind
  exists but shows "waiting for health data" until 0011 lands).
- Recurring plan templates, week-level planning.

## Tasks

- [x] Schema: `goals`, `connections` (OAuth tokens), `plans` (day-unique, like
      briefs). Pushed to Neon.
- [x] lib/goals.ts: metric registry — networth (finance), books_finished /
      learning_units_week (learning), custom (no auto metric); pace math.
- [x] lib/google.ts: OAuth URL, code exchange, token refresh, listEvents(day),
      createBlocks with `[vivy]` tag + replace-on-replan (plain fetch, no SDK).
- [x] APIs: /api/goals (+[id]), /api/google/auth + /callback + /disconnect,
      /api/plan (GET context / POST generate / POST confirm-to-calendar).
- [x] UI: /goals page, home pace card, /plan page (+ nav "Plan"), settings
      Google card.
- [x] Brief: goalsContext() + todaysPlanContext(); evening nudge URL → /plan.
- [ ] USER STEP: Google Cloud console — OAuth client (Calendar API, consent screen
      test mode, redirect URIs local+prod), put GOOGLE_CLIENT_ID/SECRET in
      apps/web/.env.local + Vercel env.

## Notes

- Calendar events are NOT copied into the events table: Google is their system of
  record and the append-only timeline would need messy upserts on every edit.
  Planner/brief query live (cached). If we later want "time actually in meetings"
  analytics, that becomes a distinct ingestor decision.
- "Liquid 1 million in 2 years": goal targets liquid net worth (cash+bank+stocks
  minus debts) — metric key `networth`, already computed by lib/finance.
