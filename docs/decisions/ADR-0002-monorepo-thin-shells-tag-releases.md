# ADR-0002: Monorepo with thin native shells; web is the single UI source; tag-triggered releases

Date: 2026-07-13 · Status: accepted

## Context

Vivy is growing surfaces: the web app (deployed on Vercel), a Chrome extension, and —
per Epic 6 — a desktop app and an Android app whose main job is OS-level activity
tracking. A heavier analysis backend (Python LangChain/LangGraph or Rust) may follow.
Everything lived flat in one Next.js root, which gave new surfaces no home and mixed
concerns.

## Decision

1. **npm-workspaces monorepo**, boring on purpose (no turborepo/nx until pain demands it):
   - `apps/web` — the Next.js app: UI + Core API + AI jobs. The one deployable today.
   - `apps/extension` — Chrome extension (thin event ingestor).
   - `apps/desktop`, `apps/android` — placeholders with written intent; real projects
     arrive with Epic 6 and their own stack ADRs (Tauri/Electron, Kotlin/Capacitor).
   - `services/analysis` — placeholder for the heavy-AI backend. **Language deliberately
     undecided** (Python vs Rust); decide as an ADR when the first workload that doesn't
     fit a Vercel function actually exists. Until then AI stays in `apps/web/lib/ai`.
2. **The web app is the single UI source.** Desktop and Android are thin shells around
   it; each shell adds only what a browser cannot do (tray + window tracker; UsageStats +
   FCM + SMS). No shell gets its own database or brain — everything is an event into the
   one timeline (CLAUDE.md rule).
3. **Releases are tags.** `.github/workflows/release.yml`: pushing a `v*` tag builds
   every app that exists (detect job — desktop/android jobs auto-activate when their
   folders become real projects), attaches artifacts to a GitHub Release with generated
   notes. Apps poll the latest release for their update notification. The web app is
   excluded — Vercel ships it on every push to main.

## Consequences

- Vercel project needs one manual setting: **Root Directory = `apps/web`** (vercel.json
  with the crons moved there too). Env vars are project-level — unaffected.
- One root lockfile (npm workspaces); `npm run dev` at root proxies to the web app.
- New surfaces get a slot without touching existing code; the release pipeline is ready
  before the apps are, so the first desktop/android commit is immediately shippable.
- Cost accepted: `@/` imports resolve within `apps/web` only; future shared code (types,
  API client) means a `packages/` workspace — deferred until two consumers exist.
