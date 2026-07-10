---
name: ship
description: Verify a spec is done, mark it, and write the journal entry
argument-hint: SPEC-XXXX
disable-model-invocation: true
---

Ship **$ARGUMENTS**.

Process:
1. Read the spec `$ARGUMENTS`. Confirm every acceptance criterion is met and every task is
   checked. If not, do the remaining work or tell me what's blocking.
2. **Verify:** run the tests / run the app. Capture the evidence into the spec's `## Notes`.
   Do not proceed without evidence. "It works" is not enough.
3. Set the spec `status: done`.
4. If a real, hard-to-reverse decision was made, write an ADR in `docs/decisions/`.
5. Append a journal entry to `docs/journal/<today>.md`: what shipped, current status, the
   next step.
6. Git: **only if I ask**, commit as `SPEC-XXXX: <summary>` on a short-lived branch.
7. Report what shipped and suggest what's next.
