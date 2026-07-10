import { NextRequest, NextResponse } from 'next/server';
import { desc, ne } from 'drizzle-orm';
import { db, learning } from '@/lib/db';

export async function GET() {
  const rows = await db
    .select()
    .from(learning)
    .where(ne(learning.status, 'dropped'))
    .orderBy(desc(learning.createdAt))
    .limit(200);
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.title || !['book', 'course'].includes(body.kind)) {
    return NextResponse.json({ error: 'kind (book|course) and title required' }, { status: 400 });
  }
  const [row] = await db
    .insert(learning)
    .values({
      kind: body.kind,
      title: body.title,
      author: body.author ?? null,
      url: body.url ?? null,
      status: body.status ?? 'backlog',
      unitName: body.unitName ?? (body.kind === 'book' ? 'chapter' : 'lesson'),
      unitsTotal: body.unitsTotal ?? null,
      startedAt: body.startedAt ?? null,
    })
    .returning();
  return NextResponse.json({ item: row });
}
