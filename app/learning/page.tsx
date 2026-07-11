import { desc, eq, ne } from 'drizzle-orm';
import { db, learning, papers, topics } from '@/lib/db';
import { LearningList } from './learning-list';
import { PapersPanel } from './papers-panel';

export const dynamic = 'force-dynamic';

export default async function LearningPage() {
  const [rows, suggested, allTopics] = await Promise.all([
    db
      .select()
      .from(learning)
      .where(ne(learning.status, 'dropped'))
      .orderBy(desc(learning.createdAt))
      .limit(200),
    db
      .select({
        id: papers.id,
        title: papers.title,
        authors: papers.authors,
        url: papers.url,
        why: papers.why,
        topicName: topics.name,
      })
      .from(papers)
      .leftJoin(topics, eq(papers.topicId, topics.id))
      .where(eq(papers.status, 'suggested'))
      .orderBy(desc(papers.suggestedAt))
      .limit(12),
    db.select().from(topics).orderBy(desc(topics.weight)),
  ]);

  return (
    <main className="space-y-8">
      <div>
        <h1 className="font-voice text-2xl italic">Learning</h1>
        <p className="mt-1 text-sm text-moth">
          Books, courses, and papers — logged one session at a time.
        </p>
      </div>
      <PapersPanel
        suggestions={suggested}
        topics={allTopics.map((t) => ({
          id: t.id,
          name: t.name,
          weight: t.weight,
          active: t.active,
        }))}
      />
      <LearningList
        initial={rows.map((r) => ({
          id: r.id,
          kind: r.kind as 'book' | 'course' | 'paper',
          title: r.title,
          author: r.author,
          status: r.status,
          unitName: r.unitName,
          unitsTotal: r.unitsTotal,
          unitsDone: r.unitsDone,
          startedAt: r.startedAt,
        }))}
      />
    </main>
  );
}
