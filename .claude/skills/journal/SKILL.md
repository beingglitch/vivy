---
name: journal
description: Write the end-of-session journal entry to preserve state
argument-hint: <optional focus note>
disable-model-invocation: true
---

Write a journal checkpoint so the next session resumes cleanly.

Process:
1. Open (or create from `docs/journal/_TEMPLATE.md`) `docs/journal/<today>.md`.
2. Append a session entry capturing:
   - **Did:** what changed this session, with SPEC ids.
   - **Status now:** the active spec and its state; anything blocked.
   - **Next:** the single next action, specific enough for a cold start to resume.
   - **Open questions / notes:** anything unresolved.
3. Make sure every spec you touched has accurate `status` frontmatter and its checklist is
   up to date.
4. If a durable decision was made and isn't yet an ADR, write one now.
5. Keep it short and factual: a flight recorder, not an essay.

Extra focus for this entry: $ARGUMENTS
