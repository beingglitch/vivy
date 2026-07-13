import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db, papers } from '@/lib/db';
import { fetchAndSuggestPapers } from '@/lib/papers';

export const maxDuration = 120;

export async function GET() {
  const rows = await db
    .select()
    .from(papers)
    .where(eq(papers.status, 'suggested'))
    .orderBy(desc(papers.suggestedAt))
    .limit(20);
  return NextResponse.json({ papers: rows });
}

// Manual "find me papers now" — the daily cron calls the same function.
export async function POST() {
  const result = await fetchAndSuggestPapers();
  return NextResponse.json(result);
}
