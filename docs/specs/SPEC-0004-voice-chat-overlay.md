# SPEC-0004 — Voice chat overlay ("talk to Vivy from anywhere")

## Goal

A floating button at the bottom-right of every page opens a mini chat overlay wired
to the same chat brain (/api/chat, all tools). Voice-first: tap the mic, speak, stop —
Vivy hears you, and depending on **Safety** either asks you to confirm or acts
immediately. Anything the chat can do (log expense, complete task, log reading,
remember) becomes doable by voice from any page.

## The interaction loop (user-specified)

1. Tap mic → **listening** (live interim transcript on screen; auto-stops on ~silence
   via Chrome endpointing).
2. **Safety ON** (default): draft shown big → mic re-arms in *command mode*:
   - "go" / "send" / "yes" → send to Vivy
   - "cancel" / "clear" / "no" → discard
   - anything else → treated as an **oral correction**: draft + instruction go to
     Haiku (`/api/voice-edit`), corrected draft comes back → review again.
3. **Safety OFF**: the draft is sent the moment you stop speaking. No confirmation.
4. Reply: streamed as text; if **Spoken replies** is on, also read aloud
   (speechSynthesis, free/on-device).

## Settings (persisted in localStorage)

- `safety` (default ON): confirm-before-send loop vs. act immediately.
- `speak` (default ON): read Vivy's replies aloud vs. text only.

## Acceptance criteria

- [x] FAB fixed bottom-right on every page (not /login), above content, thumb-sized.
- [x] Overlay: recent exchange visible, text input fallback, mic with clearly visible
      states (idle / listening / review / sending / error) — no more silent failure.
- [x] Safety loop works as specified; "go" spoken sends; oral correction rewrites the
      draft via Haiku and returns to review.
- [x] Settings toggles for safety + spoken replies, persisted.
- [x] Unsupported browsers see the text input, not a dead mic.
- [ ] Real-mic verification on user's Chrome (dictation itself can't be tested headless).

## Decisions

- Web Speech API (Chrome/Edge only, needs HTTPS on phone) — no server STT cost;
  Whisper ingestion stays the Epic 4 plan, this is the interim voice channel.
- Oral corrections go through Haiku (`VIVY_MODEL_FAST`), temperature 0, "return only
  the corrected draft" — regex can't apply "make it 300 not 200".
- Overlay owns its own useChat session; server keeps persisting to chat_messages, so
  /chat history and overlay history are the same record.
- The inline mic on /chat and the finance note field stays (plain dictation).

## Tasks

- [x] `app/vivy-fab.tsx` — FAB + overlay + speech state machine + settings
- [x] `/api/voice-edit` — Haiku draft correction
- [x] Mount in layout; hide on /login
- [x] Build + screenshot states
