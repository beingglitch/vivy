---
id: SPEC-0007
title: Task structure — areas, projects, routines
status: building
created: 2026-07-13
---

# SPEC-0007: Task structure — areas, projects, routines

## What & why

Tasks are one flat list, but Suraj's real work has shape: ongoing responsibilities that never
end (job hunt, startup, IoT lab in-charge), finite projects that do (whisper — Rust learning),
one-off tasks (meet someone today), and recurring activities (football). Flat lists make the
ongoing stuff invisible and the recurring stuff either forgotten or re-typed. Give the existing
`projects` table a real shape and add routines, so the Tasks page answers "what today?" and
"is anything important going stale?".

Four concepts:

- **Area** — ongoing, never done (job, startup, IoT lab). Health = open tasks + days since
  last movement.
- **Project** — finite, completable, optionally under an area (whisper under… nothing, it's
  standalone learning). `active → done | paused`.
- **Task** — one-off, optionally attached to an area or project. Unchanged otherwise.
- **Routine** — recurring rule + done-log, NOT a self-cloning task. Mirrors the finance
  pattern (`recurring` bills + settle-tap): a `routines` table holds the rule; tapping "did it"
  writes a `routine.done` event to the timeline. Streaks/nags derive from events.

User decisions (2026-07-13): routines support **both** schedule kinds, chosen per routine —
fixed days ("football every Sat") or weekly target ("gym ×3/week"). Task capture stays a
single text box with an **optional** area/project chip picker; untagged → inbox.

## Acceptance criteria

- [x] Schema: `projects` has `kind` ('area'|'project'), `status` ('active'|'done'|'paused'),
      `parentId` (project may sit under an area); new `routines` table with per-row schedule:
      fixed days-of-week OR times-per-week target; pushed to Neon.
- [x] Routine completion writes an event (`type: 'routine.done'`, routineId in payload) — no
      task rows created; un-tapping same day removes it.
- [x] Tasks page shows a **Today** lane: tasks with status today/doing or due today, plus
      routines due today (fixed-day match, or weekly-target not yet met), each tappable to done.
- [x] Tasks page groups open tasks by area/project below Today; each group shows its open
      count and days-since-last-movement; finite projects can be marked done and disappear
      into an archive state. (Stale badge + finish flow built; not yet observed live —
      needs 5-day-old data / a click.)
- [ ] Quick-add: one text box; optional chips to attach the new task to an area/project;
      no chip → inbox. (Built; needs a real browser click to tick.)
- [ ] Areas/projects/routines are manageable from the UI (create, rename, archive/deactivate)
      — no SQL needed to onboard "startup", "job", "iot-lab", "whisper", "football".
      (Organize drawer built; onboarding done via the same APIs it calls; needs a click.)
- [x] Weekly-target routines show progress for the current week (e.g. "2 of 3 this week")
      and count Monday–Sunday.
- [ ] Daily brief mentions routines due today and flags an active area/project with no
      movement for 5+ days. (Context wired in; tick after the next real brief.)
- [x] MCP: add_task accepts an optional project/area name; list_tasks shows the grouping;
      a tool exists to check off a routine (log_routine).

## Out of scope

- Habit streak visualizations / heatmaps (events make this possible later).
- Calendar integration or time-blocking.
- Auto-classifying existing tasks into areas (Vivy may propose later; not now).
- Linking projects to the `learning` table (whisper is also a learning item — keep separate).
- Sub-projects deeper than one level (area → project is the max).

## Tasks

- [x] Schema: extend `projects` (kind, status, parentId, createdAt already there); add
      `routines` table; drizzle push.
- [x] Seed nothing — user creates his own via UI. (Did create his four named ones —
      Startup / Job hunt / IoT lab areas, Whisper (rust) project, Football ×1/wk — via
      the new API since he named them explicitly; editable in the organize drawer.)
- [x] API: `/api/projects` (POST/PATCH/DELETE), `/api/routines` (POST/PATCH/DELETE),
      `/api/routines/[id]/done` (POST toggles today's routine.done event); `/api/tasks`
      POST + PATCH accept projectId.
- [x] Tasks page server query: tasks + projects + routines + this-week routine.done events.
- [x] UI: Today lane (tasks due/today/doing + routines due) → area/project groups with
      stale badge → inbox → done. Organize drawer for areas/projects/routines.
- [x] Quick-add chips (tap to file; "+ task" on a group preselects its chip).
- [x] Daily brief prompt: `structureContext()` — routines due + quiet areas.
- [x] MCP tools: add_task project arg, list_tasks grouped, log_routine tool.
- [x] Verify end-to-end, update TRACKER, journal entry.

## Notes

- Routine schedule storage: `integer('days_of_week').array()` nullable + `timesPerWeek`
  integer nullable; exactly one set (API enforces). 0=Sunday…6=Saturday (JS getDay()).
- "Movement" for staleness = latest of: task created/completed in group. Computable from
  tasks table (createdAt, completedAt), no new columns.
- Week boundary for targets: Monday 00:00 IST (matches how he thinks about weeks);
  helpers in `lib/routines.ts` (istToday / dayOfWeek / weekMonday — IST has no DST so
  string math on en-CA dates is safe).
- Verified 2026-07-13 (local dev via authproxy):
  - POST area/project/routine → all created; /tasks renders Today + groups + organize.
  - Football toggle: `{"done":true,"day":"2026-07-13"}` → page shows "1 of 1 this week ✓";
    un-tap → `{"done":false}` and the week's events query returns empty.
  - Task filed under Whisper appears in its group; MCP `add_task {project:"iot lab"}` →
    "filed under IoT lab"; `list_tasks` returns grouped output; `log_routine {}` lists
    routines with weekly progress. Test tasks dropped after.
  - `structureContext` aggregate SQL run against Neon directly (greatest/coalesce + filter).
- Still open before calling it DONE: a real browser click-through (chips, toggles, organize
  drawer), one real daily brief generated with structure context, and prod deploy
  (user runs `vercel --prod`).
- Gotcha found while verifying: local :3005 was running a stale `next start` prod build,
  which 404'd the new API routes until replaced with `next dev`.
