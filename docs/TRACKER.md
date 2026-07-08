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

- [ ] [ ] Scaffold Next.js (App Router, TS, Tailwind, shadcn/ui)
- [ ] [ ] Neon Postgres provisioned + Drizzle ORM wired (migrations working)
- [ ] [ ] Deployed to Vercel (preview + production), env vars managed via `vercel env`
- [ ] [ ] Single-user auth (simple passcode/session — it's my private OS)

### Event API — the one pipe [[SPEC-0001]]
Every ingestor (browser, screen agent, finance, recorder) POSTs to this. The timeline table.

- [ ] [ ] `events` table: id, ts, source, type, payload (jsonb), processed flag
- [ ] [ ] `POST /api/events` with API-key auth (for future hardware/agents)
- [ ] [ ] `GET /api/events` timeline query (filter by source/type/date)
- [ ] [ ] Processing loop: unprocessed events → AI handler by type → derived records

### Task pipeline [[SPEC-0001]]
Tasks are the first-class citizen: created manually, by chat, or extracted from any event.

- [ ] [ ] `tasks` table: title, detail, status, priority, due, project, source-event link
- [ ] [ ] Task CRUD (API + UI): inbox → today → done flow
- [ ] [ ] Projects/areas (startup, job, personal, finance) to group tasks
- [ ] [ ] AI task extraction: any ingested text event can yield proposed tasks (approve/reject)

### Daily brief — "what do we do today" [[SPEC-0001]]
The Jarvis moment: every morning Vivy decides and tells me the plan.

- [ ] [ ] Brief generator: Claude reads open tasks + deadlines + recent events → ranked plan
- [ ] [ ] Vercel Cron job (morning) writes the brief; dashboard shows it
- [ ] [ ] Brief delivery channel (email or Telegram push)
- [ ] [ ] Evening review: what got done, what rolls over

### Chat with Vivy [[SPEC-0001]]
Conversational interface over all my data, with tools.

- [ ] [ ] Chat UI (streaming) on the dashboard
- [ ] [ ] Vivy tools: query tasks/events/finance, create/complete tasks, add notes
- [ ] [ ] Persistent memory: facts Vivy learns about me stored + injected into context

**Bugs:** *(none open)*

---

## Epic 2 — Passive Tracking (knows what I watch & do)

### Browser extension — watch/browse history
- [ ] [ ] Chrome/Firefox extension: logs video watched (YouTube title/channel/duration) + significant pages → `POST /api/events`
- [ ] [ ] AI summarizer: what did I watch/read today, key takeaways as notes
- [ ] [ ] Watch-time analytics on dashboard

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

### Nudges & reviews
- [ ] [ ] Weekly review generated Sunday evening (wins, slips, next week's focus)
- [ ] [ ] Real-time nudges via push channel (screen time, deadlines, dues)
- [ ] [ ] Startup & job dashboards: goals, metrics I log, Vivy tracks progress

### Deeper memory
- [ ] [ ] Long-term memory store with retrieval (facts, preferences, people, decisions)
- [ ] [ ] "Ask Vivy anything about my life" over the full timeline (search + RAG)

**Bugs:** *(none open)*
