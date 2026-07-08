# The Guide (one page)

## Why this exists

AI writes code well but loses the plot on big projects: context resets, decisions get
forgotten, work drifts from intent. The fix is simple. **Keep the truth in markdown in the
repo, not in the agent's memory.** The agent reads it, works, and writes back. Nothing
important lives only in a chat window.

## The loop

```
spec  →  build  →  verify  →  ship  →  journal
 │         │          │         │         │
what &   do the    run it,   mark it   save where
criteria  work     show it    done    you left off
```

- **Spec** (`/spec`): before non-trivial work, write one file with the goal, the acceptance
  criteria, and a checklist of steps. If you can't state the acceptance criteria, you don't
  understand the problem yet.
- **Build**: do the next unchecked item. One thing at a time. Keep the checklist current.
- **Verify**: run it. Output or a screenshot. "It works" is a claim; running it is proof.
- **Ship** (`/ship`): criteria met, so mark the spec done and commit if asked.
- **Journal** (`/journal`): before you stop, write what changed, the status, and the next
  step. This one habit is what makes the whole thing resumable.

## The four artifacts

| Artifact | Answers | Write/update when… |
|---|---|---|
| `TRACKER.md` | what exists across the whole system + is it tested | continuously (it's the live map) |
| `specs/` | what & why + how far along | starting a feature complex enough to need design |
| `journal/` | what happened, what's next | ending a session (always) |
| `decisions/` | why we chose X (ADR) | you make a real, hard-to-reverse choice |
| `bugs/` | what broke + how to prevent it | something breaks and you want it to not recur |

`TRACKER.md` is the bird's-eye index (one line per feature, built/tested boxes); specs are
the deep plans for the few features that need one. Look at the tracker to decide what to do;
write a spec only when a feature needs thinking-through before you build it. The person who
*ran the test* flips the tested box; never mark tested from code review alone.

### Story/task vocabulary

You already have epics, stories, and tasks, so no ticket system is needed. The mapping onto
headings lives in `TRACKER.md` (its "Structure" section): epic = `##` area, story = `###`
feature (or a `SPEC` when it needs design), task = a checklist item. Add ticket IDs only
when you go team, and then use GitHub Issues, not a homemade system.

Small fix? Skip the spec: just do it and leave a journal line.

## Running a session well

- **Say what to read.** "Read `docs/specs/SPEC-0002` and `src/auth/` before writing."
- **Fence the scope.** "Only touch files under `src/auth/`. If you need something outside,
  stop and tell me." Add: "If you'd go outside this scope, stop and ask."
- **Ask for a plan-back** before big work: "List every file you'll change, then wait."
- **Review harshly** before shipping risky code: `/review`.
- **Match effort to difficulty, not size.** A 40-line concurrency fix can be harder than a
  3,000-line rename. Think harder (or use a multi-agent workflow) for genuinely hard, big,
  fan-out work, not by default.

## The one rule

**Add structure only when you feel the pain it solves, and prefer a markdown file over a
script.** This system is deliberately small. Keep it that way until reality forces more.
