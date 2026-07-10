---
name: spec
description: Write or refine a spec (what to build, with acceptance criteria and a checklist)
argument-hint: <what you want to build, free text>
disable-model-invocation: true
---

Create or refine a spec following `docs/specs/_TEMPLATE.md`.

Input: $ARGUMENTS

Process:
1. **Interview me briefly first.** Ask the few sharp questions needed to pin down the
   problem, the outcome, what's out of scope, and testable acceptance criteria. Ask them
   together, not one at a time. A spec is only as good as its acceptance criteria.
2. Assign the next free `SPEC-XXXX` id (list `docs/specs/`, take max + 1, zero-padded to 4).
3. Write `docs/specs/SPEC-XXXX-<slug>.md` from the template. Fill every section. Break the
   work into a small **Tasks** checklist. Set `status: draft`, `created` to today.
4. Report the acceptance criteria back and ask me to approve or revise before building.

Keep it about **what & why**, not implementation detail. If the work is large, keep the
checklist high-level and let it grow as you build; don't over-plan up front.
