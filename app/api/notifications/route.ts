import { NextRequest, NextResponse } from 'next/server';
import { desc, isNull, sql } from 'drizzle-orm';
import { db, notifications } from '@/lib/db';

export async function GET(req: NextRequest) {
  // ?unread=1 → just the count, for the header bell dot
  if (req.nextUrl.searchParams.get('unread')) {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(notifications)
      .where(isNull(notifications.readAt));
    return NextResponse.json({ unread: Number(row.n) });
  }
  const rows = await db.select().from(notifications).orderBy(desc(notifications.ts)).limit(50);
  return NextResponse.json({ notifications: rows });
}

// Mark everything read (opening /notifications counts as reading).
export async function PATCH() {
  await db.update(notifications).set({ readAt: new Date() }).where(isNull(notifications.readAt));
  return NextResponse.json({ ok: true });
}
