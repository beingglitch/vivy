# Vivy, working notes

## Writing style

**Never use an em dash.** Not in UI copy, not in code comments, not in docs,
commit messages, or replies in chat. This applies to the em dash character
itself and to the double-hyphen `--` that stands in for it.

Use instead, in rough order of preference:

| Instead of an em dash | Use |
| --- | --- |
| A parenthetical aside | commas, or brackets |
| Introducing an explanation | a colon |
| Joining two related clauses | a semicolon, or two sentences |
| An abrupt turn | start a new sentence |

```
Bad   Codes are hashed — a dump must yield nothing replayable.
Good  Codes are hashed, so a dump yields nothing replayable.
Good  Codes are hashed: a dump must yield nothing replayable.

Bad   Argon2id, tuned so guessing is expensive — slow on purpose.
Good  Argon2id, tuned so guessing is expensive. Slow on purpose.
```

A hyphen inside a compound word (`read-only`, `single-use`, `end-to-end`) is
fine. A minus sign in a number is fine. CLI flags like `--force` are fine. The
rule is about the dash used as punctuation between clauses.

## Working preferences

- **Ask before driving the browser.** Do not open or automate Chrome (the
  claude-in-chrome tools) without being asked. Verify from the terminal instead:
  curl the route, read the dev server log, run the typecheck.

## Project conventions

- **Money is integer minor units** (paise), never rupees as a float.
- **`dedupeKey` must be deterministic.** Build it from the observation, never
  from `Date.now()` at send time, or replay safety silently breaks.
- **Never log a payload.** Identifiers only, in errors and logs alike.
- **Collectors classify nothing.** Write `category: null` and let the on-device
  model fill it in later, across the whole archive.
- **Every user-owned table carries `userId`,** and every query filters on it.
  `prices` is the one exception: market data is identical for everyone.
- **Credentials are stored hashed,** always. Session tokens, device tokens,
  invite codes, verification codes.
- **Server actions re-check authorisation themselves.** A server action is a
  public HTTP endpoint; checking only in the page that renders the button checks
  only the place an attacker skips.

## Architecture

Full design doc: https://claude.ai/code/artifact/86718ce3-5464-4727-b380-0f29ab9f7867

Decision records live in `docs/adr/`. Read those before changing how sync,
sealing, or money capture work.
