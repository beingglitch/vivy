import { and, desc, eq, gte } from 'drizzle-orm';
import { db, events } from './db';

export type VideoWatch = {
  title: string;
  channel: string;
  url: string;
  seconds: number;
  lastTs: Date;
};

export type BrowsingStats = {
  videos: VideoWatch[];
  searches: { query: string; engine: string; ts: Date }[];
  domains: { domain: string; seconds: number }[];
  videoTypes: { category: string; seconds: number }[]; // AI-classified: education, entertainment…
  totalVideoSeconds: number;
  totalBrowseSeconds: number;
};

// Aggregate raw browser events into what the dashboard shows.
export async function browsingStats(since: Date): Promise<BrowsingStats> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.source, 'browser'), gte(events.ts, since)))
    .orderBy(desc(events.ts))
    .limit(2000);

  const videoMap = new Map<string, VideoWatch>();
  const searches: BrowsingStats['searches'] = [];
  const domainMap = new Map<string, number>();
  const typeMap = new Map<string, number>();

  for (const e of rows) {
    const p = e.payload as Record<string, unknown>;
    if (e.type === 'video.watch') {
      const url = String(p.url ?? '');
      const prev = videoMap.get(url);
      const seconds = Number(p.seconds ?? 0);
      const category = String(p.category ?? 'unsorted');
      typeMap.set(category, (typeMap.get(category) ?? 0) + seconds);
      if (prev) prev.seconds += seconds;
      else
        videoMap.set(url, {
          title: String(e.title ?? p.title ?? 'Unknown video'),
          channel: String(p.channel ?? ''),
          url,
          seconds,
          lastTs: e.ts,
        });
    } else if (e.type === 'search') {
      searches.push({
        query: String(p.query ?? e.title ?? ''),
        engine: String(p.engine ?? ''),
        ts: e.ts,
      });
    } else if (e.type === 'page.visit') {
      const domain = String(p.domain ?? '');
      const seconds = Number(p.seconds ?? 0);
      if (domain) domainMap.set(domain, (domainMap.get(domain) ?? 0) + seconds);
    }
  }

  const videos = [...videoMap.values()].sort((a, b) => b.seconds - a.seconds);
  const domains = [...domainMap.entries()]
    .map(([domain, seconds]) => ({ domain, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  const videoTypes = [...typeMap.entries()]
    .map(([category, seconds]) => ({ category, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  return {
    videos,
    searches,
    domains,
    videoTypes,
    totalVideoSeconds: videos.reduce((s, v) => s + v.seconds, 0),
    totalBrowseSeconds: domains.reduce((s, d) => s + d.seconds, 0),
  };
}

export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
