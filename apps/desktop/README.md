# apps/desktop — Linux screen-time agent

Counts **active screen seconds** (not idle, not locked) on GNOME/Wayland and ships them
to the Core Event API as `{ source: 'desktop-agent', type: 'screen.active' }` events.
Zero dependencies — Node 18+ and `gdbus` (already part of GNOME).

Deliberately coarse (no per-app names): GNOME Wayland blocks window introspection for
normal processes, and Chrome — where most desktop time goes — is already tracked
per-site by `apps/extension`. Per-app names can come later via a small GNOME Shell
extension if wanted.

## Install (auto-starts on login)

```bash
./install.sh <VIVY_INGEST_KEY> [https://vivy-sage.vercel.app]
```

That writes `~/.config/vivy/agent.env` (key stays out of the repo) and enables a
systemd user service. Check with `systemctl --user status vivy-agent`; remove with
`systemctl --user disable --now vivy-agent`.

## Tuning (agent.env or env vars)

`SAMPLE_S=15` how often it looks · `FLUSH_S=300` how often it ships ·
`IDLE_MS=60000` idle threshold. Failed flushes are kept and retried.
