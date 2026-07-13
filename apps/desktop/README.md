# apps/desktop — not built yet (Epic 6)

The desktop app. Planned shape:

- A thin shell (Tauri vs Electron — decide as an ADR when this starts) that wraps
  `apps/web` (the deployed web app), plus a system tray.
- The one native capability: an **OS-level activity tracker** — active window, per-app
  time, idle detection — batched as events (`source: 'desktop-agent'`) to the Core
  Event API. Offline queue with retry; the API already accepts batches.
- Auto-start on boot. Update check against the latest GitHub Release (tag-triggered
  builds, see Epic 6 CI/CD story).

Rules that apply here (from CLAUDE.md): this is a **thin client** — no local database,
no separate brain. Everything is an event into the one timeline.
