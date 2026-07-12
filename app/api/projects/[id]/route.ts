import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, projects } from '@/lib/db';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const patch: Partial<typeof projects.$inferInsert> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.parentId !== undefined) patch.parentId = body.parentId || null;
  if (body.status !== undefined) {
    if (!['active', 'done', 'paused'].includes(body.status)) {
      return NextResponse.json({ error: 'bad status' }, { status: 400 });
    }
    patch.status = body.status;
  }

  const [row] = await db.update(projects).set(patch).where(eq(projects.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ project: row });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await db.delete(projects).where(eq(projects.id, id));
    return NextResponse.json({ ok: true });
  } catch {
    // tasks or routines still point here — archive instead of delete
    return NextResponse.json({ error: 'has tasks or routines; archive it instead' }, { status: 409 });
  }
}
