#!/usr/bin/env node
// Vivy desktop agent (Linux/GNOME Wayland): counts ACTIVE screen seconds —
// not idle, not locked — and ships them to the Core Event API in batches.
// Zero dependencies; needs only `gdbus` (part of GNOME) and Node 18+.
//
// v1 is deliberately coarse (active time, no per-app names): GNOME Wayland
// blocks window introspection for normal processes, and Chrome — where most
// desktop time goes — is already tracked per-site by apps/extension. Per-app
// names can come later via a tiny GNOME Shell extension.
//
// Events: { source: 'desktop-agent', type: 'screen.active',
//           payload: { seconds, host } }  — one per flush window.

const { execFileSync } = require('child_process');
const { readFileSync } = require('fs');
const os = require('os');

// -- config: ~/.config/vivy/agent.env (KEY=VALUE), overridable by real env --
const CONFIG_PATH = `${os.homedir()}/.config/vivy/agent.env`;
const fileCfg = {};
try {
  for (const line of readFileSync(CONFIG_PATH, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=["']?([^"'\n]*)["']?$/);
    if (m) fileCfg[m[1]] = m[2];
  }
} catch {
  /* no config file — env vars must carry it */
}
const cfg = (k, fallback) => process.env[k] ?? fileCfg[k] ?? fallback;

const URL_BASE = cfg('VIVY_URL', 'https://vivy-sage.vercel.app');
const KEY = cfg('VIVY_INGEST_KEY', '');
const SAMPLE_S = Number(cfg('SAMPLE_S', 15)); // how often we look
const FLUSH_S = Number(cfg('FLUSH_S', 300)); // how often we ship
const IDLE_MS = Number(cfg('IDLE_MS', 60000)); // idle threshold

if (!KEY) {
  console.error(`no VIVY_INGEST_KEY (set it in ${CONFIG_PATH})`);
  process.exit(1);
}

function gdbus(dest, path, method) {
  return execFileSync(
    'gdbus',
    ['call', '--session', '--dest', dest, '--object-path', path, '--method', method],
    { encoding: 'utf8', timeout: 5000 },
  );
}

function idleMs() {
  // "(uint64 12345,)"
  const out = gdbus(
    'org.gnome.Mutter.IdleMonitor',
    '/org/gnome/Mutter/IdleMonitor/Core',
    'org.gnome.Mutter.IdleMonitor.GetIdletime',
  );
  return Number(out.match(/\d+/)?.[0] ?? 0);
}

function locked() {
  try {
    const out = gdbus('org.gnome.ScreenSaver', '/org/gnome/ScreenSaver', 'org.gnome.ScreenSaver.GetActive');
    return out.includes('true');
  } catch {
    return false; // no screensaver interface — assume unlocked
  }
}

let activeSeconds = 0;

async function flush() {
  if (activeSeconds === 0) return;
  const seconds = activeSeconds;
  try {
    const res = await fetch(`${URL_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vivy-key': KEY },
      body: JSON.stringify([
        {
          source: 'desktop-agent',
          type: 'screen.active',
          title: os.hostname(),
          payload: { seconds, host: os.hostname() },
        },
      ]),
    });
    if (res.ok) {
      activeSeconds -= seconds; // keep anything sampled while the POST ran
      console.log(`${new Date().toISOString()} shipped ${seconds}s active`);
    } else {
      console.error(`ship failed: ${res.status} — keeping ${seconds}s for retry`);
    }
  } catch (e) {
    console.error(`ship failed: ${e.message ?? e} — keeping ${seconds}s for retry`);
  }
}

function sample() {
  try {
    if (!locked() && idleMs() < IDLE_MS) activeSeconds += SAMPLE_S;
  } catch (e) {
    console.error(`sample failed: ${e.message ?? e}`);
  }
}

console.log(`vivy-agent up: sampling ${SAMPLE_S}s, flushing ${FLUSH_S}s → ${URL_BASE}`);
setInterval(sample, SAMPLE_S * 1000);
setInterval(flush, FLUSH_S * 1000);

// ship whatever we have on the way out
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await flush();
    process.exit(0);
  });
}
