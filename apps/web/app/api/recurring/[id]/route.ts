import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, recurring } from '@/lib/db';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const patch: Partial<typeof recurring.$inferInsert> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.category !== undefined) patch.category = body.category;
  if (body.note !== undefined) patch.note = body.note;
  if (body.type !== undefined) patch.type = body.type === 'income' ? 'income' : 'expense';
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.dayOfMonth !== undefined) {
    patch.dayOfMonth = Number.isInteger(body.dayOfMonth) ? body.dayOfMonth : null;
  }
  if (body.amount !== undefined) {
    const v = Number(body.amount);
    if (!Number.isFinite(v) || v <= 0) {
      return NextResponse.json({ error: 'positive amount required' }, { status: 400 });
    }
    patch.amount = v.toFixed(2);
  }

  const [row] = await db.update(recurring).set(patch).where(eq(recurring.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ recurring: row });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await db.delete(recurring).where(eq(recurring.id, id));
  return NextResponse.json({ ok: true });
}
