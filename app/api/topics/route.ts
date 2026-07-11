import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db, topics } from '@/lib/db';

export async function GET() {
  const rows = await db.select().from(topics).orderBy(desc(topics.weight));
  return NextResponse.json({ topics: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const [row] = await db
    .insert(topics)
    .values({ name, query: String(body?.query ?? '').trim() || `all:"${name}"` })
    .onConflictDoNothing()
    .returning();
  if (!row) return NextResponse.json({ error: 'topic exists' }, { status: 409 });
  return NextResponse.json({ topic: row });
}
