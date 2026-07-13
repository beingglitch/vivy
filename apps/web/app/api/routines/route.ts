import { NextRequest, NextResponse } from 'next/server';
import { db, routines } from '@/lib/db';

export async function GET() {
  const rows = await db.select().from(routines).orderBy(routines.createdAt).limit(200);
  return NextResponse.json({ routines: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  // Exactly one schedule kind: fixed days-of-week OR a times-per-week target.
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
    return NextResponse.json({ error: 'exactly one of daysOfWeek / timesPerWeek required' }, { status: 400 });
  }

  const [row] = await db
    .insert(routines)
    .values({
      name: body.name.trim(),
      daysOfWeek: days?.length ? (days as number[]).sort() : null,
      timesPerWeek: target,
      projectId: typeof body.projectId === 'string' ? body.projectId : null,
    })
    .returning();
  return NextResponse.json({ routine: row });
}
