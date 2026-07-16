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

// Parse a client-supplied timestamp. Returns a valid Date, or null if the
// string is present but unparseable (so the caller can reject it) — a bad
// clock string must never become an Invalid Date that 500s the insert.
function parseTs(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return new Date();
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

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
  const rows: { source: string; type: string; ts: Date; title: string | null; payload: Record<string, unknown> }[] = [];
  for (const e of items) {
    if (!e || typeof e.source !== 'string' || typeof e.type !== 'string') {
      return NextResponse.json({ error: 'each event needs source and type' }, { status: 400 });
    }
    const ts = parseTs(e.ts);
    if (!ts) {
      return NextResponse.json({ error: 'ts must be a valid date' }, { status: 400 });
    }
    rows.push({
      source: e.source,
      type: e.type,
      ts,
      title: e.title ?? null,
      payload: e.payload ?? {},
    });
  }

  const inserted = await db.insert(events).values(rows).returning({ id: events.id });

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
      return NextResponse.json({ error: 'since must be a valid date' }, { status: 400 });
    }
    conds.push(gte(events.ts, since));
  }
  // A bad limit (NaN, 0, negative) must fall back to the default, never reach .limit().
  const rawLimit = Math.floor(Number(p.get('limit')));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 100;

  const rows = await db
    .select()
    .from(events)
    .where(conds.length ? and(...conds) : sql`true`)
    .orderBy(desc(events.ts))
    .limit(limit);

  return NextResponse.json({ events: rows });
}
