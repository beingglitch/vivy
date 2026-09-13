import { currentTimeZone, dedupeKey, localDateOf, newId } from '@vivy/core/runtime';
import type { VivyEvent } from '@vivy/core';

/**
 * YouTube watch collector.
 *
 * This is the only reliable way to know what you actually watched: the Data API
 * has not exposed watch history since 2016, and Takeout is a manual export
 * measured in months. So we read it off the page.
 *
 * Two things make it trustworthy. We measure *played* time by sampling the video
 * element rather than wall-clock, so a paused tab and a background tab both
 * count as zero. And the dedupe key is the video id plus the session start, so a
 * reload cannot double-count and a resumed video merges server-side.
 *
 * SPA navigation means there is no page load between videos - hence the
 * `yt-navigate-finish` listener rather than anything on `window.onload`.
 */

const PARSER = 'chrome.youtube@v1';
const MIN_WATCH_S = 5;
const SAMPLE_MS = 5000;

interface Session {
  videoId: string;
  startedAt: number;
  playedS: number;
  lastSampleAt: number;
  title: string;
  channel: string | null;
  lengthS: number | null;
}

let session: Session | null = null;
let timer: number | undefined;

function videoIdFromLocation(): string | null {
  const url = new URL(location.href);
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const short = url.pathname.match(/^\/shorts\/([\w-]{5,})/);
  return short?.[1] ?? null;
}

function readTitle(): string {
  const heading = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
  if (heading?.textContent) return heading.textContent.trim();
  return document.title.replace(/ - YouTube$/, '').trim();
}

function readChannel(): string | null {
  const link = document.querySelector('ytd-channel-name a');
  return link?.textContent?.trim() || null;
}

function videoElement(): HTMLVideoElement | null {
  return document.querySelector('video.html5-main-video, video');
}

async function endSession(): Promise<void> {
  const current = session;
  session = null;
  if (!current || current.playedS < MIN_WATCH_S) return;

  const tz = currentTimeZone();
  const startedIso = new Date(current.startedAt).toISOString();
  const video = videoElement();

  const event: VivyEvent = {
    id: newId(),
    ts: startedIso,
    localDate: localDateOf(current.startedAt, tz),
    tz,
    source: 'chrome.youtube',
    deviceId: 'chrome',
    durationS: Math.round(current.playedS),
    rawId: null,
    derivedBy: PARSER,
    dedupeKey: dedupeKey('chrome.youtube', current.videoId, startedIso),
    type: 'media.watch',
    payload: {
      platform: 'youtube',
      externalId: current.videoId,
      title: current.title,
      channel: current.channel,
      lengthS: current.lengthS,
      positionS: video ? Math.round(video.currentTime) : null,
      // Left null on purpose. Classification is Tier 1's job, on your own
      // hardware, over the whole archive - not a guess made at capture time.
      category: null,
    },
  };

  try {
    await chrome.runtime.sendMessage({ vivyEvent: event });
  } catch {
    // Service worker asleep or extension reloading. The next sample re-opens a
    // session; losing one segment is acceptable, blocking the page is not.
  }
}

function sample(): void {
  const video = videoElement();
  if (!session || !video) return;
  const now = Date.now();
  // Only count time while genuinely playing. `paused` covers the tab being
  // backgrounded on mobile too, where the element suspends.
  if (!video.paused && !video.ended && video.readyState >= 2) {
    session.playedS += (now - session.lastSampleAt) / 1000;
  }
  session.lastSampleAt = now;
  if (session.lengthS === null && Number.isFinite(video.duration)) {
    session.lengthS = Math.round(video.duration);
  }
}

function startSession(videoId: string): void {
  session = {
    videoId,
    startedAt: Date.now(),
    playedS: 0,
    lastSampleAt: Date.now(),
    title: readTitle(),
    channel: readChannel(),
    lengthS: null,
  };

  // Metadata renders after the video starts; re-read once it has settled.
  window.setTimeout(() => {
    if (session?.videoId !== videoId) return;
    session.title = readTitle();
    session.channel = readChannel();
  }, 2500);
}

async function onNavigate(): Promise<void> {
  const next = videoIdFromLocation();
  if (session && session.videoId === next) return;
  await endSession();
  if (next) startSession(next);
}

document.addEventListener('yt-navigate-finish', () => void onNavigate());
window.addEventListener('pagehide', () => void endSession());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sample();
});

timer = window.setInterval(sample, SAMPLE_MS);
window.addEventListener('unload', () => window.clearInterval(timer));

void onNavigate();
