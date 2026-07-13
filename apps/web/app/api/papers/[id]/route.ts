import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db, learning, papers, topics } from '@/lib/db';

// The feedback loop lives here: reading a paper bumps its topic's weight,
// skipping decays it. Weights steer tomorrow's suggestions.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action as 'read' | 'skip' | undefined;
  if (!action) return NextResponse.json({ error: 'action (read|skip) required' }, { status: 400 });

  const [paper] = await db.select().from(papers).where(eq(papers.id, id)).limit(1);
  if (!paper) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (action === 'read') {
    const [item] = await db
      .insert(learning)
      .values({
        kind: 'paper',
        title: paper.title,
        author: paper.authors,
        url: paper.url,
        status: 'active',
        unitName: 'section',
        startedAt: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
      })
      .returning();
    await db
      .update(papers)
      .set({ status: 'reading', learningId: item.id })
      .where(eq(papers.id, id));
    if (paper.topicId) {
      await db
        .update(topics)
        .set({ weight: sql`${topics.weight} + 1` })
        .where(eq(topics.id, paper.topicId));
    }
    return NextResponse.json({ paper: { ...paper, status: 'reading' }, learningId: item.id });
  }

  await db.update(papers).set({ status: 'skipped' }).where(eq(papers.id, id));
  if (paper.topicId) {
    await db
      .update(topics)
      .set({ weight: sql`greatest(${topics.weight} - 0.2, 0.1)` })
      .where(eq(topics.id, paper.topicId));
  }
  return NextResponse.json({ paper: { ...paper, status: 'skipped' } });
}
