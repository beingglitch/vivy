---
id: SPEC-0001
title: The spine — Event API, task pipeline, daily brief, chat
status: building         # draft | building | done
created: 2026-07-08
---

# SPEC-0001: The spine — Event API, task pipeline, daily brief, chat

## What & why
Vivy needs one core that everything else plugs into: a single Event API + Postgres
timeline, a task pipeline on top of it, and an AI layer that every morning tells me
**exactly what to do today**. Once this exists, every future capability (browser tracking,
finance, meeting recorder hardware) is just a new event source — no re-architecture.

## Acceptance criteria
If all of these are true, this is done. Observable and checkable.
- [ ] `POST /api/events` (API-key auth) stores an event; `GET /api/events` returns the
      timeline filtered by source/type/date — verified with curl.
- [ ] I can create, edit, complete, and prioritize tasks in the web UI, grouped by
      project/area (startup, job, personal, finance), with due dates.
- [ ] Posting a raw text event (e.g. a pasted meeting note) results in AI-proposed tasks I
      can approve or reject in the UI.
- [ ] A morning cron generates a **daily brief**: ranked "do these today" list with
      reasoning, from open tasks + due dates + recent events. Visible on the dashboard.
- [ ] I can chat with Vivy in the dashboard; she can list/create/complete tasks and answer
      questions from my data (tool calls, streaming).
- [ ] Deployed on Vercel production with Neon Postgres; works from my phone browser.
- [ ] Behind a login only I can pass.

## Out of scope
Browser extension, screen-time agent, finance module, audio/Whisper pipeline, custom
hardware, push notifications (email/Telegram delivery of the brief is a fast-follow),
multi-user anything.

## Tasks
- [x] Scaffold Next.js (App Router, TS, Tailwind) in this repo — verified running 2026-07-08
- [x] Provision Neon Postgres (Vercel Marketplace); wire Drizzle + first migration
- [x] Schema: `events`, `tasks`, `projects`, `briefs`, `chat_messages`, `memories`
- [x] Event API routes + API-key middleware; curl smoke test
- [x] Tasks CRUD API + dashboard UI (inbox / today / done; project filters still pending)
- [x] AI layer: Claude via AI SDK through AI Gateway; `lib/ai/` with task-extraction job
- [x] Event processor: unprocessed text events → proposed tasks (approve/reject UI) —
      built + plumbing verified 2026-07-08; AI output untested (gateway blocked on card)
- [x] Daily brief generator + Vercel Cron (`/api/cron/daily-brief`) + dashboard card —
      built; AI output untested (gateway blocked)
- [x] Chat route with tools (queryTasks, createTask, completeTask, queryEvents, remember)
      + streaming chat UI — built; untested end-to-end (gateway blocked)
- [x] Simple auth (single-user passcode → session cookie) guarding everything
- [ ] Deploy intelligence layer to prod; verify all acceptance criteria from phone + laptop
      (BLOCKED: user must add card on Vercel to unlock AI Gateway free credits)

## Notes
- Architecture rule (from CLAUDE.md): everything is an event into one timeline.
- Automation rule (from CLAUDE.md): no manual data entry as a designed flow. The task UI is
  for *managing* tasks; task *creation* should increasingly come from ingestors (chat,
  calendar, Gmail, transcripts). The "pasted text → proposed tasks" criterion exists to
  prove the extraction pipeline that every automatic ingestor will reuse.
- API-key auth on `/api/events` is what future hardware/agents will use — keep it dumb
  (single `VIVY_INGEST_KEY` env var) until there are multiple devices.
- Brief ranking prompt gets: open tasks w/ priority+due, yesterday's completions, calendar
  events (later), and Vivy memories. Output: top 3 must-dos + rest, each with one-line why.
