import { currentTimeZone, dedupeKey, localDateOf, newId } from '@vivy/core/runtime';
import type { VivyEvent } from '@vivy/core';
import { enqueueEvent, flush } from './outbox';

/**
 * Tab and idle accounting.
 *
 * The unit we record is a *session*: one domain held the active tab from A to B.
 * Recording start and stop separately and pairing them later would be simpler to
 * write and much harder to trust, because a service worker can be evicted at any
 * moment. Instead the open session lives in `chrome.storage.session` and is
 * closed on every transition, so an eviction costs at most one segment.
 *
 * Idle matters more than it looks: without it, a tab left open overnight reads
 * as eight hours of attention it never had.
 */

const IDLE_SECONDS = 60;
const OPEN_KEY = 'vivy.open';
const FLUSH_ALARM = 'vivy.flush';
const PARSER = 'chrome.tabs@v1';

interface OpenSession {
  domain: string;
  url: string;
  title: string;
  startedAt: number;
}

async function getOpen(): Promise<OpenSession | null> {
  const stored = await chrome.storage.session.get(OPEN_KEY);
  return (stored[OPEN_KEY] as OpenSession | undefined) ?? null;
}

async function setOpen(session: OpenSession | null): Promise<void> {
  if (session) await chrome.storage.session.set({ [OPEN_KEY]: session });
  else await chrome.storage.session.remove(OPEN_KEY);
}

/** Close the running session, if any, and queue it. */
async function closeSession(): Promise<void> {
  const open = await getOpen();
  if (!open) return;
  await setOpen(null);

  const durationS = Math.round((Date.now() - open.startedAt) / 1000);
  // Sub-second flickers while alt-tabbing are noise, not attention.
  if (durationS < 2) return;

  const startedIso = new Date(open.startedAt).toISOString();
  const tz = currentTimeZone();

  const event: VivyEvent = {
    id: newId(),
    ts: startedIso,
    localDate: localDateOf(open.startedAt, tz),
    tz,
    source: 'chrome.tabs',
    deviceId: await deviceId(),
    durationS,
    rawId: null,
    derivedBy: PARSER,
    // Start instant plus domain identifies the segment: replaying the same
    // observation cannot create a second row.
    dedupeKey: dedupeKey('chrome.tabs', open.domain, startedIso),
    type: 'screen.site',
    payload: {
      domain: open.domain,
      url: open.url,
      title: open.title,
      category: null,
    },
  };

  await enqueueEvent(event);
}

async function openSession(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.url) return;
  let url: URL;
  try {
    url = new URL(tab.url);
  } catch {
    return;
  }
  // Nothing to learn from the browser's own pages.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  await setOpen({
    domain: url.hostname,
    url: url.href,
    title: tab.title ?? '',
    startedAt: Date.now(),
  });
}

async function transition(tab?: chrome.tabs.Tab): Promise<void> {
  await closeSession();
  if (tab) await openSession(tab);
}

async function deviceId(): Promise<string> {
  const stored = await chrome.storage.local.get('vivy.config');
  const config = stored['vivy.config'] as { deviceId?: string } | undefined;
  return config?.deviceId ?? 'chrome-unpaired';
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  await transition(tab);
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  // A same-tab navigation ends one session and starts another.
  if (changeInfo.url && tab.active) await transition(tab);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await closeSession(); // Chrome lost focus entirely.
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  await transition(tab);
});

chrome.idle.setDetectionInterval(IDLE_SECONDS);
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'active') {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await transition(tab);
  } else {
    await closeSession();
  }
});

// A service worker gets evicted; an alarm survives it.
chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FLUSH_ALARM) await flush();
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  // Content scripts hand finished observations here rather than queueing
  // directly, so all writes go through one code path.
  if (typeof message === 'object' && message !== null && 'vivyEvent' in message) {
    void enqueueEvent((message as { vivyEvent: VivyEvent }).vivyEvent).then(() =>
      sendResponse({ ok: true }),
    );
    return true; // keep the channel open for the async reply
  }
  return false;
});
