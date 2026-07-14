---
id: SPEC-0011
title: Health events + voice capture (meals, sleep) — MCP tools, chat tools, Android tile
status: building
created: 2026-07-14
---

# SPEC-0011: Health events + voice capture

## What & why

Suraj wants to tell Vivy "I ate lunch", "going to sleep", "I'm awake" with near-zero
friction. Decision (2026-07-14, after the always-on-mic problems list): NOT an
always-listening service — instead every surface that can already hear gets a
logging path: chat voice button (PWA), Claude app voice mode (via MCP), and a
one-tap Android quick-settings tile → system speech dialog. Meals/sleep are the
first health events; health goal metrics hang off them later.

## Event shapes

- `meal.logged { meal: 'breakfast'|'lunch'|'dinner'|'snack', day }` — one per meal
  per day is the norm; duplicates are fine, analysis takes distinct meals.
- `sleep.start { day }` / `sleep.wake { day }` — sleep duration = wake ts − most
  recent sleep.start within 16h.

## Acceptance criteria

- [x] lib/health.ts: logMeal / logSleep / healthToday (meals logged, asleep-or-awake,
      last night's duration) / healthContext() for AI prompts (empty until first use —
      no nagging about an unused feature).
- [x] Chat tools logMeal + logSleep wired (same lib the verified endpoint uses);
      spoken round-trip in the chat UI still to be tried by Suraj.
- [x] MCP tools log_meal + log_sleep → Claude app voice mode ("tell Vivy I ate lunch").
- [x] POST /api/voice-log { text }: Haiku classifies free text → meal/sleep event
      (keyword fallback if the model is down; note event if neither); auth = session
      OR x-vivy-key. Verified: "I just had lunch" → meal.logged{lunch}, "going to
      sleep now" → sleep.start, no auth → 401. Test events deleted.
- [x] Android: "Log to Vivy" quick-settings tile → system speech dialog → transcript
      POSTs to /api/voice-log, toast echoes Vivy's reply. Settings screen fixed:
      visible bold labels, key un-masked, ScrollView. assembleDebug green (2.28MB).
- [x] Morning brief + evening review see health via healthContext().

## Out of scope / next

- Sleep inference from phone.usage overnight gaps (the true no-manual-entry path) —
  needs a few days of phone data first.
- Health goal metrics (sleep hours/week, meals/day) — follow SPEC-0010 registry.
- Wake-word always-on service (rung 3 — only if tile friction annoys him).

## Tasks

- [x] lib/health.ts + wire healthContext into daily-brief and eveningReview.
- [x] Chat tools; MCP tools.
- [x] /api/voice-log (Haiku classify, keyword fallback, note fallback).
- [x] Android: MainActivity labels/legibility + VoiceLogActivity + TileService;
      local assembleDebug green.
- [x] Journal + tracker.
- [ ] USER: install the new APK (next tag), add the tile from quick-settings edit,
      say "ate lunch"; try voice in web chat; phone.usage already verified live.
