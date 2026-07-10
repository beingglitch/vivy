import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, tasks } from '@/lib/db';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const patch: Partial<typeof tasks.$inferInsert> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.detail !== undefined) patch.detail = body.detail;
  if (body.priority !== undefined) patch.priority = body.priority;
  if (body.due !== undefined) patch.due = body.due;
  if (body.aiProposed !== undefined) patch.aiProposed = body.aiProposed;
  if (body.status !== undefined) {
    patch.status = body.status;
    patch.completedAt = body.status === 'done' ? new Date() : null;
  }

  const [row] = await db.update(tasks).set(patch).where(eq(tasks.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ task: row });
}
