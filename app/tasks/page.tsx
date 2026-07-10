import { desc, ne } from 'drizzle-orm';
import { db, tasks } from '@/lib/db';
import { TaskList } from './task-list';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const rows = await db
    .select()
    .from(tasks)
    .where(ne(tasks.status, 'dropped'))
    .orderBy(tasks.priority, desc(tasks.createdAt))
    .limit(200);

  return (
    <main className="space-y-8">
      <div>
        <h1 className="font-voice text-2xl italic">Tasks</h1>
        <p className="mt-1 text-sm text-moth">Yours, mine, and the ones I found for you.</p>
      </div>
      <TaskList
        initial={rows.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due: t.due,
          aiProposed: t.aiProposed,
        }))}
      />
    </main>
  );
}
