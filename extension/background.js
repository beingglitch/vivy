// Vivy browser ingestor — tracks the active tab, turns attention into events:
//   video.watch  {url, title, channel, seconds}
//   search       {query, engine}
//   page.visit   {domain, url, title, seconds}
// Events queue in chrome.storage.local and flush to the Event API every minute.

const MIN_SEGMENT_SECONDS = 5;
const FLUSH_ALARM = 'vivy-flush';

// ---------- current-segment state (survives service-worker sleeps) ----------

async function getSeg() {
  const { seg } = await chrome.storage.session.get('seg');
  return seg || null;
}
async function setSeg(seg) {
  await chrome.storage.session.set({ seg });
}

// YouTube metadata reported by the content script, keyed by video URL.
async function getMeta(url) {
  const { ytMeta = {} } = await chrome.storage.session.get('ytMeta');
  return ytMeta[url] || {};
}

// ---------- URL classification ----------

const SEARCH_ENGINES = [
  { host: /(^|\.)google\./, param: 'q', engine: 'google', pathStartsWith: '/search' },
  { host: /(^|\.)bing\.com$/, param: 'q', engine: 'bing', pathStartsWith: '/search' },
  { host: /(^|\.)duckduckgo\.com$/, param: 'q', engine: 'duckduckgo', pathStartsWith: '/' },
  { host: /(^|\.)youtube\.com$/, param: 'search_query', engine: 'youtube', pathStartsWith: '/results' },
];

function parseUrl(raw) {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u;
  } catch {
    return null;
  }
}

function searchQueryOf(u) {
  for (const s of SEARCH_ENGINES) {
    if (s.host.test(u.hostname) && u.pathname.startsWith(s.pathStartsWith)) {
      const q = u.searchParams.get(s.param);
      if (q) return { query: q, engine: s.engine };
    }
  }
  return null;
}

function isYouTubeWatch(u) {
  return /(^|\.)youtube\.com$/.test(u.hostname) && u.pathname === '/watch' && u.searchParams.get('v');
}

function canonicalVideoUrl(u) {
  return `https://www.youtube.com/watch?v=${u.searchParams.get('v')}`;
}

// ---------- queue ----------

async function enqueue(event) {
  const { queue = [] } = await chrome.storage.local.get('queue');
  queue.push(event);
  if (queue.length > 2000) queue.splice(0, queue.length - 2000);
  await chrome.storage.local.set({ queue });
}

async function flush() {
  const { queue = [] } = await chrome.storage.local.get('queue');
  if (queue.length === 0) return;
  const { endpoint, apiKey } = await chrome.storage.sync.get(['endpoint', 'apiKey']);
  if (!endpoint || !apiKey) return; // not configured yet

  const batch = queue.slice(0, 400);
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vivy-key': apiKey },
      body: JSON.stringify(batch),
    });
    if (res.ok) {
      await chrome.storage.local.set({ queue: queue.slice(batch.length), lastFlush: Date.now() });
    }
  } catch {
    // offline — keep the queue, retry on next alarm
  }
}

// ---------- segment lifecycle ----------

async function closeSegment() {
  const seg = await getSeg();
  await setSeg(null);
  if (!seg) return;

  const seconds = Math.round((Date.now() - seg.start) / 1000);
  if (seconds < MIN_SEGMENT_SECONDS) return;

  const u = parseUrl(seg.url);
  if (!u) return;

  if (isYouTubeWatch(u)) {
    const url = canonicalVideoUrl(u);
    const meta = await getMeta(url);
    await enqueue({
      source: 'browser',
      type: 'video.watch',
      ts: new Date().toISOString(),
      title: meta.title || (seg.title || '').replace(/ - YouTube$/, ''),
      payload: { url, channel: meta.channel || '', seconds },
    });
  } else {
    await enqueue({
      source: 'browser',
      type: 'page.visit',
      ts: new Date().toISOString(),
      title: seg.title || '',
      payload: { domain: u.hostname.replace(/^www\./, ''), url: u.origin + u.pathname, seconds },
    });
  }
}

async function openSegment(tab) {
  if (!tab || !tab.url || !parseUrl(tab.url)) return;
  await setSeg({ url: tab.url, title: tab.title || '', start: Date.now() });
}

async function switchTo(tab) {
  await closeSegment();
  await openSegment(tab);
}

// ---------- wiring ----------

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  await switchTo(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.active) return;
  if (changeInfo.url) {
    // navigation in the active tab: close old segment, log search if it is one
    await closeSegment();
    const u = parseUrl(changeInfo.url);
    if (u) {
      const s = searchQueryOf(u);
      if (s) {
        await enqueue({
          source: 'browser',
          type: 'search',
          ts: new Date().toISOString(),
          title: s.query,
          payload: { query: s.query, engine: s.engine },
        });
      }
    }
    await openSegment(tab);
  } else if (changeInfo.title) {
    const seg = await getSeg();
    if (seg && seg.url === tab.url) await setSeg({ ...seg, title: changeInfo.title });
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await closeSegment(); // browser lost focus — stop counting
  } else {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    await switchTo(tab);
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.kind === 'yt-meta' && msg.url) {
    chrome.storage.session.get('ytMeta').then(({ ytMeta = {} }) => {
      ytMeta[msg.url] = { title: msg.title, channel: msg.channel };
      const keys = Object.keys(ytMeta);
      if (keys.length > 200) delete ytMeta[keys[0]];
      chrome.storage.session.set({ ytMeta });
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) flush();
});
