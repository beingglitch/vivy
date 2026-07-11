import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, positions } from '@/lib/db';
import { snapshotNetWorth } from '@/lib/networth';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const patch: Partial<typeof positions.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = body.name;
  if (body.category !== undefined) patch.category = body.category;
  if (body.note !== undefined) patch.note = body.note;
  if (body.consider !== undefined) patch.consider = Boolean(body.consider);
  if (body.nextOutflow !== undefined) {
    const n = Number(body.nextOutflow);
    patch.nextOutflow = Number.isFinite(n) && n > 0 ? n.toFixed(2) : null;
  }
  if (body.value !== undefined) {
    const v = Number(body.value);
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ error: 'non-negative value required' }, { status: 400 });
    }
    patch.value = v.toFixed(2);
  }

  const [row] = await db.update(positions).set(patch).where(eq(positions.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await snapshotNetWorth();
  return NextResponse.json({ position: row });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await db.delete(positions).where(eq(positions.id, id));
  await snapshotNetWorth();
  return NextResponse.json({ ok: true });
}
