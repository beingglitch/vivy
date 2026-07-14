import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, goals } from '@/lib/db';
import { METRICS, readMetric, type MetricKey } from '@/lib/goals';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const patch: Partial<typeof goals.$inferInsert> = {};
  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.deadline !== undefined) patch.deadline = body.deadline || null;
  if (body.note !== undefined) patch.note = body.note?.trim() || null;
  if (body.target !== undefined) {
    patch.target =
      Number.isFinite(Number(body.target)) && body.target !== '' ? String(Number(body.target)) : null;
  }
  if (body.status !== undefined) {
    if (!['active', 'done', 'dropped'].includes(body.status)) {
      return NextResponse.json({ error: 'bad status' }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (body.metric !== undefined) {
    const metric: MetricKey | null = body.metric && body.metric in METRICS ? body.metric : null;
    patch.metric = metric;
    patch.startValue = metric ? String(await readMetric(metric)) : null; // re-baseline on metric change
  }

  const [row] = await db.update(goals).set(patch).where(eq(goals.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ goal: row });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await db.delete(goals).where(eq(goals.id, id));
  return NextResponse.json({ ok: true });
}
