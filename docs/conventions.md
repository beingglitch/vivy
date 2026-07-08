# Conventions

The rules code must follow. With an AI writing much of it, these keep the codebase
coherent; they're the tiebreaker when styles diverge. Keep this short and specific; tailor
it to your stack.

## Code
- Smallest change that works. Prefer editing existing files over adding new ones.
- Match the surrounding code: naming, structure, comment density.
- Comments explain *why*, not *what*. No dead code, no speculative abstraction.
- Fail loudly in dev; handle errors at boundaries; never swallow them silently.
- Use the project's formatter/linter. Formatting isn't an opinion; automate it.
  _(Add: formatter cmd, linter cmd, test cmd here.)_

## Git
- One logical change per commit. Reference the spec: `SPEC-XXXX: <summary>`.
- Short-lived branches off the main branch. Commit only when asked.
- Never commit secrets. `.env` stays out of the repo.

## Verified means
- Acceptance criteria demonstrated, not asserted: tests passing, or the app run with output
  captured into the spec's Notes.
- A bug fix gets a regression test that fails before and passes after.
- No new warnings; type/lint clean before ship.
