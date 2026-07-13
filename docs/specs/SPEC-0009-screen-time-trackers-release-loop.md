---
id: SPEC-0009
title: Screen-time trackers (Linux agent + Android app) + tag-release update loop
status: building
created: 2026-07-13
---

# SPEC-0009: Screen-time trackers + release update loop

## What & why

The point of Epic 6's native surfaces, per Suraj: **screen time**. Android is necessary
(nothing tracks the phone today); desktop is good-if-possible (Chrome is already covered
by the extension). Plus the delivery loop: push a `v*` tag → CI builds installables →
the web app's /settings shows "latest version + download".

## Acceptance criteria

- [x] Linux agent (apps/desktop): counts active screen seconds (idle- and lock-aware,
      GNOME Wayland via Mutter IdleMonitor), batches `screen.active` events to the Event
      API with retry; installable as a systemd user service via `install.sh`.
      (Verified live: events landed in prod timeline, source `desktop-agent`.)
- [ ] Agent installed and running on Suraj's machine (classifier blocked me from
      enabling the service — user runs `./install.sh <key>`).
- [x] Android app (apps/android): Kotlin, zero UI libs; one screen (URL + ingest key +
      grant-usage-access + sync); WorkManager 6h job ships `phone.usage` daily snapshot
      (per-app minutes from UsageStatsManager). Local debug APK build succeeds (2.3MB).
- [ ] APK installed on the phone, usage access granted, `phone.usage` events visible in
      the timeline. (User step — needs the physical phone.)
- [x] Release workflow: tag → extension zip + linux-agent tarball + debug APK → GitHub
      Release with generated notes.
- [x] Web update surface: /api/releases (public GitHub API, 5-min cache) + "Apps &
      updates" card on /settings with per-asset download buttons.
- [ ] Tag v0.1.0 pushed; workflow green; release visible; card shows the three assets.

## Out of scope

- Per-app window names on Linux (GNOME Wayland blocks introspection; would need a shell
  extension — noted in apps/desktop/README).
- Signed release APK / Play Store; in-app self-update on Android (the card is the
  update channel for now).
- Windows/macOS agents; UI charts for desktop/phone screen time (next: fold into
  /browsing and home screen-time tiles).

## Tasks

- [x] apps/desktop: agent.js + install.sh + README; live-verified against prod.
- [x] apps/android: gradle project (AGP 8.11, Kotlin 2.0.21, wrapper committed),
      MainActivity + UsageWorker; local assembleDebug green.
- [x] Workflow: desktop-agent tarball job; android job → assembleDebug, renamed APK.
- [x] /api/releases + AppsCard on /settings.
- [ ] Tag v0.1.0, verify workflow + release + card end-to-end.
- [ ] Journal + tracker.

## Notes

- Event shapes: `screen.active { seconds, host }` (many per day, sum them);
  `phone.usage { day, totalMinutes, apps[] }` (snapshot, take latest per day).
- Gradle: no system gradle needed — wrapper generated from the dist cached in
  ~/.gradle/wrapper/dists (8.14.3). First gradle run hit a transient DNS failure on
  dl.google.com; plain retry fixed it.
- CI android job writes local.properties from $ANDROID_HOME (preinstalled on
  ubuntu-latest runners).
