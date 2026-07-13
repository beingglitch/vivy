# apps/android — Vivy Screen Time

Minimal Kotlin app (no Compose, zero UI libraries) that ships the phone's per-app
screen time to the Core Event API:

- `MainActivity` — one screen: Vivy URL + ingest key (stored in SharedPreferences),
  a button to grant **usage access** (special permission via Settings), save & sync.
- `UsageWorker` — WorkManager job every 6h: `UsageStatsManager` daily buckets → one
  event `{ source: 'android', type: 'phone.usage', payload: { day, totalMinutes,
  apps: [{ app, pkg, minutes }] } }`. Apps under a minute are dropped. Analysis takes
  the latest snapshot per `payload.day`.

## Build

```bash
cd apps/android && ./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

CI builds this on every `v*` tag and attaches `vivy-screentime-<tag>.apk` to the
GitHub Release; the /settings "Apps & updates" card in the web app links it for
download. Debug-signed on purpose — personal sideload, no keystore to manage.

## Install on the phone

Download the APK from /settings → allow "install unknown apps" → open → grant usage
access in the app (step 1) → paste the ingest key (step 2) → save & sync.
