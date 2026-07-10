---
name: bug
description: Record and (optionally) fix a bug as a post-mortem with root cause + prevention
argument-hint: <symptom / description of the bug>
disable-model-invocation: true
---

Handle this bug: $ARGUMENTS

Process:
1. Assign the next free `BUG-XXXX` id (list `docs/bugs/`, max + 1, zero-padded to 4).
2. Create `docs/bugs/BUG-XXXX-<slug>.md` from `docs/bugs/_TEMPLATE.md`. Fill **Symptom**
   now (error, repro steps). Set `severity` and `found` to today.
3. **Investigate the root cause.** Read the relevant code, reproduce if possible. Write the
   *actual* underlying cause into **Root cause**, not just the surface symptom. Fill **How
   it was introduced** and set `ai_generated` honestly (was the buggy code agent-written?).
4. If I ask you to fix it (or it's obvious and low-risk):
   - Make the smallest change that fixes the root cause. Fill **Fix** with `file:line`.
   - Add a **regression test** that fails before and passes after.
   - Verify it. Set `status: resolved`, `resolved` to today.
5. Fill **Prevention**: the regression test, and any convention/CLAUDE.md rule or scope
   fence that would stop this class of bug recurring. Apply that update if it's cheap.
6. Append a journal line. If the fix is a real architectural change, write an ADR.

The point of this file is that a future agent can read it and avoid repeating the mistake.
Don't skip Root cause or Prevention.
