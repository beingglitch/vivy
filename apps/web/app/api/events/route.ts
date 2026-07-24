import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db, events } from '@/lib/db';
import { verifySessionValue, SESSION_COOKIE } from '@/lib/auth';
import { processEvents } from '@/lib/ai/process-events';

// Types worth processing the moment they arrive (task extraction). Analytics
// events (video.watch, page.visit…) wait for the cron sweep instead.
const INSTANT_TYPES = new Set(['note', 'meeting.note', 'transcript', 'email', 'text']);

function hasIngestKey(req: NextRequest): boolean {
  const key =
    req.headers.get('x-vivy-key') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return !!key && key === process.env.VIVY_INGEST_KEY;
}

type IncomingEvent = {
  source: string;
  type: string;
  ts?: string;
  title?: string;
  payload?: Record<string, unknown>;
};

// The one pipe. Every ingestor — browser extension, screen agent, finance,
// recorder hardware — POSTs one event or an array of them here.
export async function POST(req: NextRequest) {
  if (!hasIngestKey(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid json' }, { status: 400 });

  const items: IncomingEvent[] = Array.isArray(body) ? body : [body];
  if (items.length === 0 || items.length > 500) {
    return NextResponse.json({ error: 'expected 1–500 events' }, { status: 400 });
  }
  for (const e of items) {
    if (!e || typeof e.source !== 'string' || typeof e.type !== 'string') {
      return NextResponse.json({ error: 'each event needs source and type' }, { status: 400 });
    }
    // Guard bad timestamps: one malformed ts must not 500 the whole batch insert.
    if (e.ts !== undefined && Number.isNaN(new Date(e.ts).getTime())) {
      return NextResponse.json({ error: 'invalid ts (use ISO 8601)' }, { status: 400 });
    }
  }

  const inserted = await db
    .insert(events)
    .values(
      items.map((e) => ({
        source: e.source,
        type: e.type,
        ts: e.ts ? new Date(e.ts) : new Date(),
        title: e.title ?? null,
        payload: e.payload ?? {},
      })),
    )
    .returning({ id: events.id });

  // Fire-and-forget after the response: text events → AI task extraction now.
  if (items.some((e) => INSTANT_TYPES.has(e.type))) {
    after(async () => {
      await processEvents().catch((err) => console.error('processEvents failed:', err));
    });
  }

  return NextResponse.json({ ok: true, count: inserted.length });
}

// Timeline query: /api/events?source=browser&type=video.watch&since=2026-07-01&limit=100
export async function GET(req: NextRequest) {
  const sessionOk = await verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value);
  if (!sessionOk && !hasIngestKey(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const p = req.nextUrl.searchParams;
  const conds = [];
  if (p.get('source')) conds.push(eq(events.source, p.get('source')!));
  if (p.get('type')) conds.push(eq(events.type, p.get('type')!));
  if (p.get('since')) {
    const since = new Date(p.get('since')!);
    if (Number.isNaN(since.getTime())) {
      return NextResponse.json({ error: 'invalid since (use ISO 8601)' }, { status: 400 });
    }
    conds.push(gte(events.ts, since));
  }
  // Clamp limit to 1–500; a non-numeric or junk value falls back to the default.
  const rawLimit = Number(p.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 500) : 100;

  const rows = await db
    .select()
    .from(events)
    .where(conds.length ? and(...conds) : sql`true`)
    .orderBy(desc(events.ts))
    .limit(limit);

  return NextResponse.json({ events: rows });
}
