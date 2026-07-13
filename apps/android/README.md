# apps/android — not built yet (Epic 6)

The Android app. Planned shape:

- Wrapper around `apps/web` (Capacitor) or native Kotlin — decide as an ADR when this
  starts. The web app is the single UI source; this shell adds what the browser can't:
- **UsageStats** permission → daily per-app screen-time events to the Core Event API.
- Push notifications: the web-push module (SPEC-0008) already works inside the PWA;
  a native shell would swap in an FCM adapter next to `sendPushToAll` in
  `apps/web/lib/notify.ts` — the notifications table/rules/bell stay unchanged.
- Later (Epic 3): SMS listener → bank-transaction events.

Rules that apply here (from CLAUDE.md): thin client, no local database, everything is
an event into the one timeline.
