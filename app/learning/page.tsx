import { desc, ne } from 'drizzle-orm';
import { db, learning } from '@/lib/db';
import { LearningList } from './learning-list';

export const dynamic = 'force-dynamic';

export default async function LearningPage() {
  const rows = await db
    .select()
    .from(learning)
    .where(ne(learning.status, 'dropped'))
    .orderBy(desc(learning.createdAt))
    .limit(200);

  return (
    <main className="space-y-8">
      <div>
        <h1 className="font-voice text-2xl italic">Learning</h1>
        <p className="mt-1 text-sm text-moth">Books and courses — logged one session at a time.</p>
      </div>
      <LearningList
        initial={rows.map((r) => ({
          id: r.id,
          kind: r.kind as 'book' | 'course',
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
