# How we work here

Markdown is the source of truth. You (the agent) read it, do the work, and write back to it.
That's the whole idea. It's what keeps a big project coherent across context resets.

## The map + four folders

- `docs/TRACKER.md`: the whole project at a glance (every feature, is-it-built, is-it-tested).
  Keep it current; it's how we decide what to do next and see risk (built-but-untested).
- `docs/specs/`: what we're building, with goal + acceptance criteria + a task checklist in one file.
- `docs/journal/`: dated log of what happened and what's next (this beats context amnesia).
- `docs/decisions/`: why we chose things (ADRs, e.g. "SQL not NoSQL").
- `docs/bugs/`: what broke, the root cause, and how we stopped it recurring.

The tracker is the index; a spec is a deep plan for one complex feature. Don't write a spec
per tracker line. Only the person who *ran the test* flips a tracker item's tested box.

## Every session

1. Read the latest `docs/journal/` entry to recover where things stand.
2. Do the work against the active spec's acceptance criteria and checklist.
3. Before you stop (or when context runs low): write a journal entry with what changed, the
   current status, and the next step. This is non-negotiable; it's how the next session resumes.

## Rules

- Anything non-trivial starts with a spec. A one-line fix can skip to code + a journal line.
- One thing at a time. Keep the spec's checklist ticked off as you go.
- Verify before you claim done: run it, show the output.
- Smallest change that meets the acceptance criteria. Prefer editing over creating files.
- Follow `docs/conventions.md`. Record real decisions as ADRs; write up real bugs.
- Unsure *what* to build? Ask. Unsure *how*? Decide, and note it.

## Commands

- `/spec`: write or refine what we're building.
- `/ship`: verify a spec is done, then write the journal entry.
- `/review`: a harsh, adversarial review of recent changes.
- `/bug`: record a bug with its root cause and prevention.
- `/journal`: checkpoint state before you stop.

## Project

- Name: **Vivy**
- What it is (one sentence): A personal AI assistant ecosystem ("Jarvis") — one Event API +
  one database + one AI brain that ingests everything about my life (tasks, meetings,
  videos watched, screen time, finances, startup/job work) and proactively tells me what to
  do today.
- Stack: Next.js (App Router) + TypeScript on Vercel · Neon Postgres (Drizzle ORM) ·
  Claude API via AI SDK (AI Gateway) · future ingestors (browser extension, screen-time
  agent, audio recorder → Whisper) are thin clients that POST events to the Core API.
- Layout: npm-workspaces monorepo (ADR-0002). The Next app lives in **`apps/web`** (run
  dev/build/drizzle from there; `.env.local` is there too). `apps/extension` is the
  Chrome extension; `apps/desktop`, `apps/android`, `services/analysis` are reserved
  slots — read their READMEs before building into them. Tag `v*` → release workflow.
- Architecture rule: **everything is an event into one timeline.** New capabilities are new
  ingestors or new AI jobs over the same store — never a separate app with its own database.
- Automation rule: **no manual data entry.** Every data source must have an automatic
  ingestor (agent, extension, email/SMS/bank/calendar connection). Manual entry exists only
  as a debug fallback, never as the designed flow.
