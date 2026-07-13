import { NextRequest, NextResponse } from 'next/server';
import { desc, gte } from 'drizzle-orm';
import { db, transactions } from '@/lib/db';
import { intParam } from '@/lib/query';

export async function GET(req: NextRequest) {
  const days = intParam(req.nextUrl.searchParams.get('days'), { fallback: 31, max: 365 });
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(transactions)
    .where(gte(transactions.ts, since))
    .orderBy(desc(transactions.ts))
    .limit(500);
  return NextResponse.json({ transactions: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!body || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'positive amount required' }, { status: 400 });
  }
  const [row] = await db
    .insert(transactions)
    .values({
      amount: amount.toFixed(2),
      type: body.type === 'income' ? 'income' : 'expense',
      category: body.category ?? 'other',
      note: body.note ?? null,
      ts: body.ts ? new Date(body.ts) : new Date(),
      source: body.source ?? 'manual',
      recurringId: typeof body.recurringId === 'string' ? body.recurringId : null,
    })
    .returning();
  return NextResponse.json({ transaction: row });
}
