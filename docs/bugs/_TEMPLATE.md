---
id: BUG-XXXX
title: <short symptom-based title>
status: open            # open | investigating | resolved | wontfix
severity: medium        # low | medium | high | critical
ai_generated:           # yes | no | partial (was the buggy code agent-written?)
found: YYYY-MM-DD
resolved:               # YYYY-MM-DD
spec:                   # [[SPEC-XXXX]] related spec, if any
commit:                 # fix commit hash
created: YYYY-MM-DD
---

# BUG-XXXX: <title>

## Symptom
What was observed. Exact error message, wrong output, or behavior. Steps to reproduce.

## Root cause
The *actual* underlying reason, not the surface symptom. Dig until it's the real cause.

## How it was introduced
When/where the defect entered, and whether it was human- or agent-written. This is how the
project learns which kinds of changes are risky.

## Fix
What changed and where (`file:line`), and the commit.

## Prevention
The most valuable section. How do we stop this class of bug recurring?
- Regression test added: `<path>`
- Convention/CLAUDE.md updated: `<what rule>`
- Scope fence or check that would have caught it
