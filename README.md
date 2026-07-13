# Vivy

A personal AI assistant ecosystem — my Jarvis. One spine (Event API + Postgres + Claude),
many ingestors (browser, screen-time agent, finance importer, audio recorder hardware),
one assistant that knows everything and **tells me what to do today**.

```
                    ┌─────────────────────────────┐
   INGESTORS        │        CORE (the spine)      │        INTERFACES
                    │                              │
 Browser extension ─┤                              ├─ Web dashboard
 (videos watched)   │   Event API  →  Postgres     │  (tasks, money, notes)
                    │                              │
 Screen-time agent ─┤   AI layer (Claude):         ├─ Chat with Vivy
 (laptop/phone)     │   • extract tasks from       │  (ask anything about
                    │     transcripts              │   my life/data)
 Finance importer  ─┤   • categorize expenses      │
 (bank CSV, manual) │   • summarize videos/meetings├─ Daily briefing
                    │   • daily brief & nudges     │  ("do these 3 today")
 Hardware recorder ─┤   • long-term memory         │
 (mic → Whisper →   │                              ├─ Proactive alerts
  transcript)       └─────────────────────────────┘
```

**Stack:** Next.js (App Router) + TypeScript · Vercel · Neon Postgres + Drizzle ·
Claude via AI SDK · Vercel Cron for the proactive jobs.

**Core principle:** everything — a watched video, an expense, a meeting transcript, a
screen-time sample — is *an event flowing into one timeline*. Adding a capability means
adding an ingestor or an AI job, never a second app.

## Repo layout (npm workspaces — ADR-0002)

```
apps/web           Next.js app: UI + Core API + AI jobs (deploys via Vercel, root dir = apps/web)
apps/extension     Chrome extension — browsing/watch ingestor
apps/desktop       (placeholder) thin shell around web + OS activity tracker — Epic 6
apps/android       (placeholder) thin shell around web + UsageStats/FCM/SMS — Epic 6
services/analysis  (placeholder) heavy AI backend; language TBD (Python vs Rust, open ADR)
docs               tracker · specs · journal · decisions · bugs — the source of truth
```

`npm run dev` at the root runs the web app. Pushing a `v*` tag builds every app that
exists into a GitHub Release (`.github/workflows/release.yml`); the web app ships from
Vercel on every push to main. Desktop and Android are wrappers around `apps/web` —
the web app is the single UI source; shells only add what a browser can't do.

## Roadmap (see `docs/TRACKER.md` for the live map)

1. **Spine + task pipeline** — Event API, DB, tasks/notes, daily "do this today" brief, chat.
2. **Passive tracking** — browser extension (videos/pages), screen-time agent + suggestions.
3. **Finance** — expenses, debt, bank import, AI categorization, monthly analysis.
4. **Meeting pipeline** — record (phone first, custom hardware later) → transcribe → auto
   notes/tasks/schedule.
5. **Proactive Vivy** — she initiates: nudges, weekly reviews, startup/job dashboards.

## How this repo is run

This project uses the Vibe Coding OS: markdown is the source of truth. Read
`docs/GUIDE.md`. Start every session from the latest `docs/journal/` entry; decide what to
do from `docs/TRACKER.md`; `/spec` before non-trivial work; `/journal` before stopping.
