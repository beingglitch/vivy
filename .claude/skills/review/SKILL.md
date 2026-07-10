---
name: review
description: Adversarial review of recent changes (find bugs, edge cases, security holes)
argument-hint: [SPEC-XXXX | file/dir | blank for current diff]
disable-model-invocation: true
---

Do a harsh, adversarial review of: ${ARGUMENTS:-the current working changes}

Adopt the stance of a skeptical senior engineer who assumes the code is wrong until proven
otherwise. Do **not** be reassuring; your job is to find what's broken.

1. Determine what to review: a spec's changes, a named file/dir, or the current `git diff`.
2. Read the changed code fully (not skim), plus the spec's acceptance criteria if there is
   one; the spec is the rubric.
3. Hunt for, and report concretely (with `file:line` and a failure scenario):
   - **Correctness bugs:** logic errors, off-by-one, wrong assumptions.
   - **Edge cases:** null/empty/boundary inputs, concurrency, ordering, failure paths.
   - **Security:** injection, missing input validation, secret/PII leakage, authz gaps.
   - **Spec gaps:** acceptance criteria not actually met, or silently out of scope.
   - **Reliability:** unhandled errors, resource leaks, flaky assumptions.
4. Rank findings by severity. For each: what breaks, the concrete input/state that triggers
   it, and the fix. Separate "must fix" from "consider."
5. If you find nothing real, say so plainly; don't invent issues to seem thorough.

Report only. Do not edit code unless I ask.
