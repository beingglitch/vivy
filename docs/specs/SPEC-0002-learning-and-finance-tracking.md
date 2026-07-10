---
id: SPEC-0002
title: Learning tracker (books + courses) & manual finance entry
status: building         # draft | building | done
created: 2026-07-11
---

# SPEC-0002: Learning tracker (books + courses) & manual finance entry

## What & why
User reads books and takes courses; both are "a thing with units I finish over time" —
one `learning` concept (kind: book|course), progress logged in units (chapters/lessons).
This is prime coaching material for the daily brief (streaks, stalls, too-many-open).
Finance starts with a manual daily-expense page — an explicit INTERIM step (the automation
rule stands: bank/SMS/Gmail auto-ingestion is the designed flow, Epic 3); manual entry is
the debug fallback that also defines the `transactions` schema auto-ingestors will fill.

## Decisions (discussed 2026-07-11)
- One `learning` table for books AND courses, not two: same lifecycle, same UI, same coach.
- Progress unit per item (`unitName`: chapter/lesson/page/hour), `unitsTotal` optional →
  % + progress bar when known.
- Each log = an `events` row (`type: learning.log`) so the timeline/brief sees it, plus a
  cached `unitsDone` counter on the row for cheap UI.
- `transactions` is a real table (SQL aggregation by category/month), not events-payload.
- Chat can do both: logLearning + logExpense tools ("read 5 chapters", "spent 250 lunch").
- Notion: one-time import of Books + Courses now; Vivy becomes source of truth (gradual
  migration, no two-way sync).

## Acceptance criteria
- [ ] /learning shows my books & courses (active/backlog/done), each with progress, and I
      can log "+N units" inline; a `learning.log` event lands in the timeline.
- [ ] /finance lets me enter amount+category+note in <5 seconds; shows today's entries and
      this month's total by category.
- [ ] Chat: "I read 5 chapters of X" and "spent 250 on lunch" both persist correctly.
- [ ] Daily brief coaches on reading/course consistency (days since last log, stalls) and
      mentions yesterday's spend when there is one.
- [ ] Notion Books (8) + Courses (13) imported with correct statuses.

## Out of scope
Bank/SMS/Gmail auto-ingestion (Epic 3 proper), budgets, recurring detection, Notion
two-way sync, reading-time estimates.

## Tasks
- [x] Schema: `learning`, `transactions`; drizzle push — applied 2026-07-11
- [x] APIs: /api/learning (GET/POST), /api/learning/[id] (PATCH incl. +units log),
      /api/transactions (GET/POST) — curl-verified 2026-07-11
- [x] UI: /learning page, /finance page, nav links — 200 authed; not yet clicked in browser
- [x] Chat tools: logLearning, addLearning, logExpense, queryFinance, queryLearning
- [x] Brief: learning activity (days-since-last-session) + spend summary in coach prompt
- [x] Import Notion books (8) + courses (13); logged 5 chapters Art of Thinking Clearly (5/99)
- [x] Build + local verify + tracker/journal
