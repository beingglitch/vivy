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
- [x] [x] Processing loop: unprocessed events → AI handler by type → derived records. `lib/ai/process-events.ts` (Haiku), runs after each text-event ingest (`after()`) + `/api/cron/process`. Verified 2026-07-08 after gateway unlock: 3 analyzed, 2 correct tasks proposed, 0 errors. 2026-07-13: fixed BUG-0001 (events over the 25-text/60-video per-run caps were marked processed without AI → silently dropped); re-verify against real data

### Task pipeline [[SPEC-0001]]
Tasks are the first-class citizen: created manually, by chat, or extracted from any event.

- [x] [x] `tasks` table: title, detail, status, priority, due, project, source-event link
- [x] [ ] Task CRUD (API + UI): API curl-verified; UI renders but not yet clicked through in a browser
- [ ] [ ] Projects/areas (startup, job, personal, finance) — table exists, no UI/grouping yet
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
- [ ] [ ] Replace manual with auto-ingestion (Epic 3: SMS/Gmail/bank) — manual stays as fallback

**Bugs:** BUG-0001 (resolved 2026-07-13) — processing loop marked over-cap text/video events processed without AI, silently dropping them; see `docs/bugs/BUG-0001-*`.

---

## Epic 2 — Passive Tracking (knows what I watch & do)

### Browser extension — watch/browse history
- [x] [x] Chrome MV3 extension in `extension/`: YouTube watches (title/channel/seconds), searches (google/bing/ddg/yt), per-site time → batched `POST /api/events`. Verified in user's real Chrome 2026-07-08: video.watch with channel + time-by-site showing on /browsing
- [x] [ ] AI daily summary (`/api/cron/daily-summary`, Vercel Cron 09:00 IST, Haiku) — gateway unlocked 2026-07-08 (card added); first real cron run pending
- [x] [x] Watch-time analytics: `/browsing` page (videos, searches, time-by-site, 24h/7d/30d) — verified with synthetic events
- [x] [x] AI video classification (education/entertainment/music/…, Haiku batch, cron every 4h) + "video time by type" band on /browsing + brief context — verified 2026-07-11: Friends→entertainment, Coinbase breakdown→tech, Akon→music

### Screen-time agent
- [ ] [ ] Linux agent (active window + app time sampler) → events, auto-starts on boot
- [ ] [ ] Daily screen-time rollup + AI suggestions ("3h YouTube — cap it tomorrow?")
- [ ] [ ] Android usage-stats companion app → events (automatic, no manual logging)

### Life-account ingestors (email & calendar)
- [ ] [ ] Google Calendar sync: meetings/events flow into the timeline + daily brief
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
- [ ] [ ] Weekly review generated Sunday evening (wins, slips, next week's focus)
- [ ] [ ] Real-time nudges via push channel (screen time, deadlines, dues)
- [ ] [ ] Startup & job dashboards: goals, metrics I log, Vivy tracks progress

### Deeper memory
- [ ] [ ] Long-term memory store with retrieval (facts, preferences, people, decisions)
- [ ] [ ] "Ask Vivy anything about my life" over the full timeline (search + RAG)

**Bugs:** *(none open)*
