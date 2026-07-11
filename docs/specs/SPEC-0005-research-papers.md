# SPEC-0005 — Research papers: the identity-discovery engine

## Goal

Vivy suggests research papers across my interest areas, watches which ones I actually
read, and shifts future suggestions toward the topics I gravitate to. I don't declare
who I am — the reading behavior reveals it, and Vivy reports it back over time.

## Model

- `topics`: name, arXiv query, **weight** (interest score), active flag. Seeded with:
  startup & business, blockchain, SLAM, visual navigation, reinforcement learning,
  AI agents, software development. Fully editable in the UI (add/rename/pause/remove).
- `papers`: arXiv id (unique), title, authors, abstract, url, published date, topic
  link, status (`suggested | reading | skipped | done`), `why` (one line from Haiku on
  why it matters to me), learningId once reading starts.
- Reading a paper = a `learning` row with kind **paper** (unit: section/page) — same
  +N logging, same brief coaching as books and courses.

## Suggestion algorithm (daily, piggybacked on the daily-summary cron)

1. For each active topic: pull newest arXiv submissions (free API), drop ones already
   seen.
2. One Haiku call ranks candidates given topic weights: pick **3 overall**, but every
   topic where I currently have a paper `reading` keeps at least one suggestion
   present (user rule: "always keep the ones I've read, topic-wise").
3. Each pick gets a one-line "why read this" tied to my goals.

## Feedback loop (the whole point)

- Start reading → topic weight **+1**; skip → **−0.2** (floor 0.1); each `learning.log`
  on a paper → its topic **+0.25**. Higher weight → more of that topic tomorrow.
- Later (not now): video.watch classifications feed the same weights; weekly brief
  reports the drift ("6 SLAM papers, blockchain untouched 3 weeks — that's a signal").

## Acceptance criteria

- [x] Schema + seed of 7 topics pushed to Neon.
- [x] `fetchAndSuggestPapers()` pulls real arXiv entries, Haiku picks with why-lines,
      rows land as `suggested` (verified with a real run).
- [x] /learning: suggestions queue (title, topic chip, why, link, read/skip) + Papers
      section (kind paper) + topics editor (add/pause/remove, weights visible).
- [x] Start reading creates the learning item, bumps weight; skip decays it.
- [ ] Daily cron produces fresh suggestions in prod (needs deploy + a day).

## Decisions

- arXiv only for v1 — free, no key, covers SLAM/RL/agents/CS. Startup/business barely
  exists on arXiv (econ.GN is the closest); web-source ingestion is a later addition,
  not a reason to block v1.
- No new Vercel cron (Hobby quota) — paper fetch rides `/api/cron/daily-summary`.
- Weights are a single numeric column, adjusted by simple rules — no ML, inspectable,
  editable by hand. It should stay explainable ("why am I seeing this?").

## Tasks

- [x] Schema: `topics`, `papers` (+ learning kind 'paper' allowed in API)
- [x] `lib/papers.ts`: arXiv fetch (no deps), Haiku ranking, suggestion writes
- [x] Cron hookup + `/api/papers/[id]` (read/skip) + `/api/topics` CRUD
- [x] /learning UI: suggestions, topics editor, papers section
- [x] Verify with a real fetch locally; screenshots
