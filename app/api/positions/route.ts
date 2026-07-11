import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db, positions } from '@/lib/db';
import { snapshotNetWorth } from '@/lib/networth';

export async function GET() {
  const rows = await db.select().from(positions).orderBy(desc(positions.value)).limit(200);
  return NextResponse.json({ positions: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const value = Number(body?.value);
  if (!body?.name || !['asset', 'liability'].includes(body.kind) || !Number.isFinite(value) || value < 0) {
    return NextResponse.json(
      { error: 'name, kind (asset|liability) and non-negative value required' },
      { status: 400 },
    );
  }
  const nextOutflow = Number(body.nextOutflow);
  const [row] = await db
    .insert(positions)
    .values({
      kind: body.kind,
      name: body.name,
      category: body.category ?? 'other',
      value: value.toFixed(2),
      consider: body.consider === false ? false : true,
      nextOutflow: Number.isFinite(nextOutflow) && nextOutflow > 0 ? nextOutflow.toFixed(2) : null,
      note: body.note ?? null,
    })
    .returning();
  await snapshotNetWorth();
  return NextResponse.json({ position: row });
}
