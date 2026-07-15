# Feature Tracker

The bird's-eye map of the whole project: what's built, what's tested, what's pending. Open
this to decide what to do next and to see risk at a glance. Keep it always-current.

## Structure = story/task, no ticket system

The heading levels **are** the hierarchy. There are no ticket IDs; the checklist is the
task list.

| Level | Is a… | In this file |
|---|---|---|
| `##` | **Epic** | a major area / pillar |
| `###` | **Story** | a feature group (link a `specs/SPEC-XXXX` if it needs design) |
| `- [ ] [ ]` | **Task** | a unit of work; nest sub-tasks beneath it |

## Legend

**Status (first box):** `[x]` done · `[ ]` planned · `[~]` in progress · `[!]` bug · `[-]` dropped/deferred

**Tested (second box):** `[x]` tested OK · `[ ]` not yet tested · `[!]` tested, bug found

**Rules:** only the person who *ran the test* flips the second box. Move items between
sections instead of deleting. Dated one-line bug notes under **Bugs**; post-mortems in
`docs/bugs/`.

---

## Epic 1 — The Spine (core platform)

### Project scaffold & deploy pipeline
Next.js + TypeScript app, Neon Postgres, Drizzle, deployed on Vercel from day one.

- [x] [x] Scaffold Next.js (App Router, TS, Tailwind) — dev server verified 2026-07-08; shadcn/ui pending
- [x] [x] Neon Postgres provisioned (Vercel Marketplace) + Drizzle wired; `drizzle-kit push` applied 2026-07-08
- [x] [x] Deployed to Vercel production — https://vivy-sage.vercel.app — curl-verified 2026-07-08
- [x] [x] Single-user auth (passcode → HMAC session cookie, proxy.ts wall) — verified: 401/redirect unauthed, 200 authed
- [x] [x] PWA: manifest + icons (public past the auth wall) + apple meta, installable — manifest/icon 200-verified 2026-07-11 [[SPEC-0003]]
- [x] [x] Chart-first dashboard (stat tiles, collapsed brief, 2×2 14-day trend grid, domains + learning progress) — screenshot-verified 2026-07-11
- [x] [x] Home net-worth hero (full-width, links to /finance) + daily/monthly on every stat tile — 390px screenshot-verified 2026-07-11
- [x] [x] Mobile fit: nav self-scrolls (was widening the page), donut legend stacks, position bars wrap — 390px screenshot-verified 2026-07-11
- [x] [x] Personalization: settings table + /settings page (name, DOB), greeting uses name, age (2 decimals) beside home net worth, name memory for chat/brief — screenshot-verified 2026-07-12
- [x] [x] Mobile bottom tab bar (Home/Tasks/Learn/Money/Browse, active state; chat = FAB); top bar reduced to wordmark + settings — screenshot-verified 2026-07-12

### Event API — the one pipe [[SPEC-0001]]
Every ingestor (browser, screen agent, finance, recorder) POSTs to this. The timeline table.

- [x] [x] `events` table: id, ts, source, type, title, payload (jsonb), processed flag
- [x] [x] `POST /api/events` with API-key auth, single or batch (1–500) — curl-verified local + prod
- [x] [x] `GET /api/events` timeline query (source/type/since/limit) — curl-verified
- [x] [x] Processing loop: unprocessed events → AI handler by type → derived records. `lib/ai/process-events.ts` (Haiku), runs after each text-event ingest (`after()`) + `/api/cron/process`. Verified 2026-07-08 after gateway unlock: 3 analyzed, 2 correct tasks proposed, 0 errors

### Task pipeline [[SPEC-0001]]
Tasks are the first-class citizen: created manually, by chat, or extracted from any event.

- [x] [x] `tasks` table: title, detail, status, priority, due, project, source-event link
- [x] [ ] Task CRUD (API + UI): API curl-verified; UI renders but not yet clicked through in a browser
- [x] [x] Task structure [[SPEC-0007]]: areas (ongoing: startup, job hunt, IoT lab) vs projects (finite: whisper) vs routines (recurring: football, fixed-days or ×N/week) — schema + APIs + /tasks re-cut (Today lane / groups with stale badges / inbox) + organize drawer; curl-verified full round-trip 2026-07-13 (create → file task → routine toggle → grouped MCP list); UI not yet clicked in browser
- [x] [ ] Daily brief knows the structure: routines due today + quiet areas context (`structureContext`) — SQL verified against Neon, no brief generated with it yet
- [x] [ ] MCP additions: add_task files by project name, list_tasks grouped, new log_routine tool — verified locally, prod pending deploy
- [x] [x] AI task extraction: any ingested text event can yield proposed tasks (approve/reject UI on /tasks) — verified 2026-07-08: note → 2 correct tasks with due dates; UI approve flow not yet clicked

### Daily brief — "what do we do today" [[SPEC-0001]]
The Jarvis moment: every morning Vivy decides and tells me the plan.

- [x] [x] Brief generator: Claude reads open tasks + deadlines + 7-day trend + memories → ranked coach-style plan (`lib/ai/daily-brief.ts`, Sonnet) — verified locally 2026-07-08, real brief generated
- [x] [ ] Vercel Cron job (09:15 IST) writes the brief; dashboard shows today's brief card
- [ ] [ ] Brief delivery channel (email or Telegram push)
- [ ] [ ] Evening review: what got done, what rolls over

### Chat with Vivy [[SPEC-0001]]
Conversational interface over all my data, with tools.

- [x] [ ] Chat UI (streaming) at /chat, history persisted in chat_messages — built 2026-07-08; gateway blocked
- [x] [ ] Voice chat overlay [[SPEC-0004]]: bottom-right FAB on every page, safety mode (review draft → say "go" / oral correction via Haiku), spoken replies toggle — built 2026-07-11; needs real-mic test by user
- [x] [ ] Vivy tools: queryTasks, createTask, completeTask, queryEvents, remember — built; untested
- [x] [ ] Persistent memory: `remember` tool writes memories; injected into chat + brief prompts
- [x] [x] MCP server at /api/mcp/[secret] (stateless Streamable HTTP, URL-secret auth, 10 tools over the same store) for claude.ai custom connector — curl-verified full handshake + task round-trip 2026-07-12; connector add in claude.ai pending user deploy

### Learning tracker — books & courses [[SPEC-0002]]
One `learning` concept (kind: book|course), unit-based progress, coached in the brief.

- [x] [x] `learning` table + APIs + /learning UI (+N logging, progress bars, add forms) — API curl-verified 2026-07-11; UI not yet clicked
- [x] [x] Progress logs land as `learning.log` events; brief coaches on days-since-last-session
- [x] [x] Notion import: 8 books + 13 courses with real statuses (one-time, 2026-07-11)
- [x] [ ] Chat tools: logLearning / addLearning / queryLearning — built, untested in chat
- [x] [ ] Unit picker (chapter/page/section/lesson/module/hour/video/episode) on add + edit forms — built 2026-07-11
- [x] [x] Straight columns on /learning (fixed grid tracks per row) — screenshot-verified 2026-07-11
- [x] [x] Research papers [[SPEC-0005]]: topics (7 seeded, weighted, editable) + arXiv fetch + Haiku picks w/ why-lines + links — real run 2026-07-11: 7 papers suggested, all topics covered
- [x] [x] Paper feedback loop: start-reading → learning kind 'paper' + topic weight +1; skip → −0.2 — API-verified 2026-07-11 (weight 1.0→2.0, learning row created)
- [x] [ ] Daily paper suggestions via cron (piggybacked on daily-summary) — wired; first prod run pending deploy
- [x] [x] Beginner recalibration: survey/tutorial candidates + beginner-aware ranking (he's read 1 paper) — re-run verified 2026-07-11: 2/3 picks are surveys
- [x] [x] One-minute daily card on /learning (simple-English word+scenario+grammar, 3 real HN news picks w/ links, micro-bio; no repeats in 14d) — real run + screenshot 2026-07-11

### Finance — manual entry (interim; auto-ingestion is the designed flow) [[SPEC-0002]] [[SPEC-0003]]
- [x] [x] `transactions` table + /finance page (amount+category+note, today list, month by category) — curl-verified 2026-07-11
- [x] [ ] Chat tools: logExpense / queryFinance; brief mentions yesterday + 7d spend — built, untested
- [x] [x] Income entry (spent/got toggle on quick entry) + money-flow card (in vs out, net) — rendered 2026-07-11
- [x] [x] Donut chart of month-by-category (validated dark palette, legend w/ % + amounts) — screenshot-verified 2026-07-11
- [x] [x] Net worth: `positions` table (assets/liabilities, consider flag, planned payments) + huge centered hero number — GET/PATCH curl-verified + screenshot 2026-07-11
- [x] [x] Net-worth history: `networth_snapshots` (upsert on every position change + daily cron) + trend chart on /finance — seeded + rendered 2026-07-11
- [x] [x] Notion "Finance Tracker" one-time import: 10 positions (incl. 5 personal debts, college fee not-counted) + 7 recurring rules — verified in DB + UI 2026-07-11
- [x] [ ] Recurring rules: `recurring` table + UI (add/edit/pause/remove) + next-month forecast (recurring + planned debt payments + pace) — rows render; PATCH/DELETE untested
- [x] [ ] Voice input (Web Speech API) on chat + finance note — mic renders 2026-07-11; real dictation not yet tried
- [x] [x] Bills vs daily split: `transactions.recurring_id`, one-tap settle chips, paid-of-total header + progress bar, daily chart/pace exclude bills — API-tested + screenshots 2026-07-12; header re-cut to daily / monthly / recurring (daily + recurring = monthly) same day
- [x] [ ] Age display toggle on both heroes: days-to-next-birthday ↔ years+months, persisted — countdown state screenshot-verified 2026-07-12; the tap itself needs a real click
- [ ] [ ] Replace manual with auto-ingestion (Epic 3: SMS/Gmail/bank) — manual stays as fallback

**Bugs:** *(none open)*

---

## Epic 2 — Passive Tracking (knows what I watch & do)

### Browser extension — watch/browse history
- [x] [x] Chrome MV3 extension in `extension/`: YouTube watches (title/channel/seconds), searches (google/bing/ddg/yt), per-site time → batched `POST /api/events`. Verified in user's real Chrome 2026-07-08: video.watch with channel + time-by-site showing on /browsing
- [x] [ ] AI daily summary (`/api/cron/daily-summary`, Vercel Cron 09:00 IST, Haiku) — gateway unlocked 2026-07-08 (card added); first real cron run pending
- [x] [x] Watch-time analytics: `/browsing` page (videos, searches, time-by-site, 24h/7d/30d) — verified with synthetic events
- [x] [x] AI video classification (education/entertainment/music/…, Haiku batch, cron every 4h) + "video time by type" band on /browsing + brief context — verified 2026-07-11: Friends→entertainment, Coinbase breakdown→tech, Akon→music

### Screen-time agent
- [ ] [ ] Daily screen-time rollup + AI suggestions ("3h YouTube — cap it tomorrow?")
- *(the OS-level collectors — desktop agent + Android usage-stats app — moved to Epic 6, which owns the native shells they ship inside)*

### Life-account ingestors (email & calendar)
- [ ] [ ] Google Calendar sync: meetings/events flow into the timeline + daily brief *(OAuth + live read/write exists via SPEC-0010 planner; timeline ingestion of attended events still open)*
- [ ] [ ] Gmail ingestor: bookings, deadlines, bills, action-needed mails → events → tasks

**Bugs:** *(none open)*

---

## Epic 3 — Finance (records, debt, expenses) — fully automatic ingestion

### Auto-ingestion (no manual entry — this is the designed flow)
- [ ] [ ] Gmail ingestor: transaction/receipt/bill emails auto-parsed → transaction events
- [ ] [ ] Bank SMS ingestor (Android forwarder app → Event API) → transaction events
- [ ] [ ] Bank account connection (Account Aggregator / Plaid-class API, per my region)
- [ ] [ ] Dedup engine: same transaction seen via SMS + email + bank feed = one record

### Ledger & intelligence
- [ ] [ ] `transactions` table, AI auto-categorization on ingest
- [ ] [ ] Debts auto-derived from EMI/loan patterns + statements; payoff tracking
- [ ] [ ] Recurring items auto-detected (rent, subscriptions, salary)
- [ ] [ ] Monthly AI analysis: burn rate, category trends, debt payoff advice
- [ ] [ ] Alerts: upcoming dues, unusual spend, low runway — into daily brief

**Bugs:** *(none open)*

---

## Epic 4 — Meeting Pipeline (the hardware dream)

### Software pipeline first (phone as the recorder)
- [ ] [ ] Audio upload endpoint → Whisper transcription → transcript event
- [ ] [ ] AI meeting processor: summary, decisions, action items → tasks, schedule items
- [ ] [ ] Meeting notes view (searchable)

### Custom hardware (after pipeline proven)
- [ ] [ ] Device spec: ESP32/Pi Zero + mic, battery, push-to-record, WiFi upload
- [ ] [ ] Firmware: record → chunk → upload to Event API
- [ ] [ ] Consent/privacy protocol (recording others requires consent — design for it)

**Bugs:** *(none open)*

---

## Epic 5 — Proactive Vivy (she initiates)

### Self-improvement loop [[SPEC-0006]]
- [x] [x] `noteFeedback` chat tool → feedback events + docs/FEEDBACK.md fallback queue — built 2026-07-11
- [x] [ ] Nightly cloud routine "Vivy night engineer" (Opus, 3:00 AM IST): one small frontend/backend improvement → PR, never main — created 2026-07-11; first-night PR pending
- [ ] [ ] Auto-merge trivial PR classes (copy/docs) once PR quality is proven

### Nudges & reviews
- [x] [x] Notification module [[SPEC-0008]]: web push (VAPID) + in-app bell + /notifications; rules × Haiku wording — morning brief headline (rides brief cron), midday overspend check (14:00 IST, >2× 30-day avg and >₹500), evening review (21:30 IST: done count, leftovers, routines owed, stalled learning, due-tomorrow → "line up tomorrow"); per-day dedupe — cron/dedupe/bell/page verified locally 2026-07-13; real device push pending user enable + Vercel VAPID env vars
- [ ] [ ] Weekly review generated Sunday evening (wins, slips, next week's focus)
- [ ] [ ] Real-time nudges (screen time, dues) beyond the three daily slots
- [ ] [ ] Startup & job dashboards: goals, metrics I log, Vivy tracks progress

### Goals & nightly planner [[SPEC-0010]]
- [x] [x] Goals: table + /goals page + home pace card; progress auto-computed from the timeline (networth / books-finished / learning-units-week metrics), pace math ("behind; needs +₹44k/month") — verified locally 2026-07-14
- [x] [x] Nightly planner: /plan — intent → Claude time-blocks tomorrow around calendar + routines + deadlines + goal pace; plan feeds next morning's brief; evening nudge links to /plan — generation verified locally 2026-07-14
  - [x] [ ] /plan load-error state: a failed `/api/plan` fetch no longer sticks on "Loading tomorrow…" forever — now shows "Couldn't load tomorrow · Try again" with a retry (2026-07-15 night)
- [x] [ ] Google Calendar OAuth (read + write `[vivy]` blocks): flow + token store + live-query + create/replace built — **needs user's GOOGLE_CLIENT_ID/SECRET, then connect + live verify**
- [ ] [ ] Health goal metrics (sleep/meals) — capture events exist (SPEC-0011); metric registry entries still to add

### Health & voice capture [[SPEC-0011]]
- [x] [x] meal.logged / sleep.start / sleep.wake events + lib/health (healthToday, healthContext into brief + evening review) — voice-log endpoint verified 2026-07-14 ("I just had lunch" → meal.logged{lunch}; 401 without auth)
- [x] [x] /api/voice-log: free text → Haiku classify → right event (keyword fallback); session or x-vivy-key auth
- [x] [ ] Capture surfaces: chat tools logMeal/logSleep (spoken round-trip untried), MCP log_meal/log_sleep (Claude app voice mode), Android quick-settings tile → speech dialog → voice-log — APK builds; **user: install new APK + add tile**
- [ ] [ ] Sleep inference from phone.usage overnight gap (the true no-manual-entry path — needs a few days of phone data)

### Deeper memory
- [ ] [ ] Long-term memory store with retrieval (facts, preferences, people, decisions)
- [ ] [ ] "Ask Vivy anything about my life" over the full timeline (search + RAG)

**Bugs:** *(none open)*

---

## Epic 6 — Native Surfaces & Release Pipeline (desktop + Android apps, CI/CD)

**Deferred by design (2026-07-13): start only after the task flow is finalized** — SPEC-0007
clicked through in a real browser and lived-with for a few days. Everything stays a thin
client over the same Event API + one database (architecture rule); the apps exist to (a)
track activity at OS level, not just in the browser, and (b) carry Vivy everywhere.
Needs a spec before building (stack choice desktop shell / Android approach = ADRs).

### Desktop-fit web UI
The UI was built mobile-first; desktop used to get a stretched phone layout.
- [x] [x] First pass (2026-07-13): shell widens to 6xl on lg; home = hero thesis + instruments left (2×2 charts + activity lists) with sticky "today" rail right (tiles + brief); tasks = two-pane (capture+Today pinned left, areas/inbox/archive right) — mobile order untouched via lg:-only classes; headless-Chrome screenshot-verified at 1440px (home/tasks/finance)
- [ ] [ ] Second pass: finance/learning/browsing desktop compositions; brief open-by-default on desktop
- [ ] [ ] Keyboard-first quick capture (global "add task/expense" command palette)

### Desktop app (re-scoped 2026-07-13: purpose is screen time, not a shell) [[SPEC-0009]]
- [x] [x] Linux screen-time agent (apps/desktop): active seconds via Mutter IdleMonitor (Wayland), lock-aware, batched `screen.active` events w/ retry — live-verified against prod timeline 2026-07-13
- [ ] [ ] USER: run `apps/desktop/install.sh <VIVY_INGEST_KEY>` (systemd user service; classifier blocked agent-side install)
- [-] [ ] Shell app (Tauri/Electron) — dropped from scope; web + PWA is the interface, per user ("not necessary for desktop")
- [ ] [ ] Per-app names on Linux (needs GNOME shell extension) — optional later

### Android app [[SPEC-0009]]
- [x] [x] Vivy Screen Time app (apps/android): Kotlin, zero UI libs; usage-access grant screen + WorkManager 6h sync → `phone.usage` daily snapshots (per-app minutes) — assembleDebug builds locally (2.3MB APK); decision: native Kotlin, no Capacitor (purpose is tracking, web is the UI)
- [ ] [ ] USER: install APK from /settings on the phone, grant usage access, paste ingest key; then verify `phone.usage` events in timeline
- [ ] [ ] Push notifications: web push already works in the PWA; FCM adapter only if a native shell ever replaces it
- [ ] [ ] (later, ties into Epic 3) SMS listener → bank-transaction events
- [ ] [ ] Fold desktop+phone screen time into home/browsing charts (today they only count browser events)

### Repo structure & DX (pulled forward 2026-07-13)
- [x] [x] npm-workspaces monorepo [[ADR-0002]]: apps/web (Next app moved wholesale, git history kept), apps/extension, placeholder apps/desktop + apps/android + services/analysis with intent READMEs; backend language (Python vs Rust) deliberately open — verified: install/tsc/dev server/authed pages all green from new layout
- [ ] [ ] USER: Vercel dashboard → Settings → Build & Deployment → Root Directory = `apps/web` (required before next deploy)

### CI/CD & releases [[SPEC-0009]]
- [x] [x] GitHub Actions release workflow: `v*` tag → extension zip + linux-agent tarball + debug APK → GitHub Release with generated notes — v0.1.0 built green on first run, all 3 assets attached (2026-07-13)
- [x] [x] Update surface on the web app: /api/releases (public GitHub API, 5-min cache) + "Apps & updates" card on /settings with download buttons — verified serving the live v0.1.0 assets (2026-07-13)
- [ ] [ ] In-app self-update on Android (check latest tag, prompt install) — the /settings card is the update channel until then
- [ ] [ ] (web already ships via Vercel on every push — unchanged)

**Bugs:** *(none open)*
