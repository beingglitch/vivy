import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db, recurring } from '@/lib/db';

export async function GET() {
  const rows = await db.select().from(recurring).orderBy(desc(recurring.amount)).limit(200);
  return NextResponse.json({ recurring: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!body?.name || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'name and positive amount required' }, { status: 400 });
  }
  const [row] = await db
    .insert(recurring)
    .values({
      name: body.name,
      amount: amount.toFixed(2),
      type: body.type === 'income' ? 'income' : 'expense',
      category: body.category ?? 'bills',
      dayOfMonth: Number.isInteger(body.dayOfMonth) ? body.dayOfMonth : null,
      note: body.note ?? null,
    })
    .returning();
  return NextResponse.json({ recurring: row });
}
