# SPEC-0006 — The self-improvement loop (night engineer)

## Goal

Vivy improves her own code — frontend AND backend — while the user sleeps, with a
human merge as the only gate to production.

## The loop

1. **Signal** — user tells Vivy feedback in chat → `noteFeedback` tool writes a
   `feedback` event (type `feedback`, processed=false). Fallback/manual queue:
   `docs/FEEDBACK.md`.
2. **Agent** — a scheduled cloud Claude Code routine ("Vivy night engineer",
   Opus, 3:00 AM IST / 21:30 UTC nightly) clones this repo cold and reads
   CLAUDE.md, the latest journal entry, TRACKER.md, FEEDBACK.md (+ DB feedback
   events when the environment has DATABASE_URL).
3. **One small change** — priority: feedback → open bugs → unticked tracker tasks
   → code quality (frontend polish or backend algorithm/query improvements).
   Diff target ≤ ~150 lines. `npm run build` must pass.
4. **Gate** — branch `night/<slug>` + PR; **never main, never deploy, never
   schema/auth/proxy/env/crons**. Vercel gives the PR a preview URL; the user
   merges or rejects in the morning. Docs updated by the agent itself (tracker
   line + journal entry) so the next night resumes with context.

## Acceptance criteria

- [x] `noteFeedback` chat tool writes feedback events
- [x] `docs/FEEDBACK.md` queue exists
- [x] Nightly cloud routine created (3:00 AM IST, Opus) with the guardrails below
- [ ] First night PR reviewed by the user (quality calibration)
- [ ] Later: auto-merge trivial classes (copy/docs) once trust is earned

## Guardrails (verbatim in the routine prompt)

- ONE small change per night; if everything looks risky, push analysis-only journal
  branch instead of code.
- Never touch: `lib/auth.ts`, `proxy.ts`, `.env*`, `vercel.json` crons,
  `lib/db/schema.ts` (schema needs the human), no `drizzle-kit push`, no paid AI
  calls from scripts, never write to the database.
- Simple English in user-facing copy; existing design tokens; money math changes
  require tests or get skipped.

## Decisions

- Cloud routine (Claude Code) rather than the app calling the AI Gateway to edit
  itself: gateway credit is ~$5 and a server mutating its running code has no
  review gate. The PR flow reuses the whole GitHub/Vercel safety net.
- Opus per the user's explicit choice (heavier usage per run; smallest-task-first
  keeps runs short).
- DB feedback visibility from the cloud env is optional: works via docs queue
  today; add DATABASE_URL to the cloud environment to unlock live feedback reads.
