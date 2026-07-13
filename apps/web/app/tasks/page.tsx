import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db, tasks, projects, routines, events } from '@/lib/db';
import { istToday, weekMonday } from '@/lib/routines';
import { TaskList } from './task-list';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const today = istToday();
  const monday = weekMonday(today);

  const [taskRows, projectRows, routineRows, doneEvents] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(ne(tasks.status, 'dropped'))
      .orderBy(tasks.priority, desc(tasks.createdAt))
      .limit(300),
    db.select().from(projects).orderBy(projects.createdAt).limit(100),
    db.select().from(routines).orderBy(routines.createdAt).limit(100),
    // this week's routine.done events — ISO day strings compare correctly as text
    db
      .select({ payload: events.payload })
      .from(events)
      .where(and(eq(events.type, 'routine.done'), sql`${events.payload}->>'day' >= ${monday}`)),
  ]);

  // Per-routine completion state for the current Mon–Sun week.
  const doneDays = new Map<string, string[]>();
  for (const e of doneEvents) {
    const p = e.payload as { routineId?: string; day?: string };
    if (!p.routineId || !p.day) continue;
    doneDays.set(p.routineId, [...(doneDays.get(p.routineId) ?? []), p.day]);
  }

  // "Movement" per project = the newest task created or completed under it; the
  // groups UI turns silence into a stale badge so ongoing areas can't go invisible.
  const lastMove = new Map<string, number>();
  for (const t of taskRows) {
    if (!t.projectId) continue;
    const ts = Math.max(t.createdAt.getTime(), t.completedAt?.getTime() ?? 0);
    if (ts > (lastMove.get(t.projectId) ?? 0)) lastMove.set(t.projectId, ts);
  }

  return (
    <main className="space-y-8">
      <div>
        <h1 className="font-voice text-2xl italic">Tasks</h1>
        <p className="mt-1 text-sm text-moth">Yours, mine, and the ones I found for you.</p>
      </div>
      <TaskList
        today={today}
        tasks={taskRows.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due: t.due,
          projectId: t.projectId,
          aiProposed: t.aiProposed,
        }))}
        projects={projectRows.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind as 'area' | 'project',
          status: p.status as 'active' | 'done' | 'paused',
          parentId: p.parentId,
          staleDays: lastMove.has(p.id) ? Math.floor((Date.now() - lastMove.get(p.id)!) / 86_400_000) : null,
        }))}
        routines={routineRows.map((r) => {
          const days = doneDays.get(r.id) ?? [];
          return {
            id: r.id,
            name: r.name,
            daysOfWeek: r.daysOfWeek,
            timesPerWeek: r.timesPerWeek,
            projectId: r.projectId,
            active: r.active,
            doneToday: days.includes(today),
            doneThisWeek: days.length,
          };
        })}
      />
    </main>
  );
}
