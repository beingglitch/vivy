import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, ne } from 'drizzle-orm';
import { db, tasks } from '@/lib/db';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status');
  const rows = await db
    .select()
    .from(tasks)
    .where(status ? eq(tasks.status, status) : ne(tasks.status, 'dropped'))
    .orderBy(tasks.priority, desc(tasks.createdAt))
    .limit(200);
  return NextResponse.json({ tasks: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const [row] = await db
    .insert(tasks)
    .values({
      title: body.title,
      detail: body.detail ?? null,
      status: body.status ?? 'inbox',
      priority: body.priority ?? 2,
      due: body.due ?? null,
      aiProposed: body.aiProposed ?? false,
    })
    .returning();
  return NextResponse.json({ task: row });
}
