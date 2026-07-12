import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, routines } from '@/lib/db';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const patch: Partial<typeof routines.$inferInsert> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.projectId !== undefined) patch.projectId = body.projectId || null;
  if (body.daysOfWeek !== undefined || body.timesPerWeek !== undefined) {
    const days = Array.isArray(body.daysOfWeek)
      ? [
          ...new Set(
            body.daysOfWeek.filter(
              (d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6,
            ),
          ),
        ]
      : null;
    const target =
      Number.isInteger(body.timesPerWeek) && body.timesPerWeek >= 1 && body.timesPerWeek <= 7
        ? body.timesPerWeek
        : null;
    if ((days?.length ? 1 : 0) + (target ? 1 : 0) !== 1) {
      return NextResponse.json(
        { error: 'exactly one of daysOfWeek / timesPerWeek required' },
        { status: 400 },
      );
    }
    patch.daysOfWeek = days?.length ? (days as number[]).sort() : null;
    patch.timesPerWeek = target;
  }

  const [row] = await db.update(routines).set(patch).where(eq(routines.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ routine: row });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await db.delete(routines).where(eq(routines.id, id));
  return NextResponse.json({ ok: true });
}
