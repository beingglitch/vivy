import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, transactions } from '@/lib/db';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = await db.delete(transactions).where(eq(transactions.id, id)).returning();
  if (rows.length === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
