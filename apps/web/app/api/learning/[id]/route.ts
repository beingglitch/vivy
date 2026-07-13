import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, learning } from '@/lib/db';
import { logLearningProgress } from '@/lib/learning';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  // { logUnits: 5, note? } — a progress log rather than a field edit.
  if (typeof body.logUnits === 'number' && body.logUnits > 0) {
    const item = await logLearningProgress(id, Math.round(body.logUnits), body.note ?? null, 'manual');
    if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ item });
  }

  const patch: Partial<typeof learning.$inferInsert> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.author !== undefined) patch.author = body.author;
  if (body.url !== undefined) patch.url = body.url;
  if (body.unitsTotal !== undefined) patch.unitsTotal = body.unitsTotal;
  if (body.unitName !== undefined) patch.unitName = body.unitName;
  if (body.status !== undefined) {
    patch.status = body.status;
    if (body.status === 'done') patch.finishedAt = new Date().toISOString().slice(0, 10);
  }

  const [row] = await db.update(learning).set(patch).where(eq(learning.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ item: row });
}
