import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, papers, topics } from '@/lib/db';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const patch: Partial<typeof topics.$inferInsert> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.query !== undefined) patch.query = String(body.query).trim();
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.weight !== undefined && Number.isFinite(Number(body.weight))) {
    patch.weight = Math.max(0.1, Number(body.weight)).toFixed(2);
  }
  const [row] = await db.update(topics).set(patch).where(eq(topics.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ topic: row });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // Papers keep existing but lose the topic link (FK would block the delete).
  await db.update(papers).set({ topicId: null }).where(eq(papers.topicId, id));
  await db.delete(topics).where(eq(topics.id, id));
  return NextResponse.json({ ok: true });
}
