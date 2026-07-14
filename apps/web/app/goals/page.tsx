import { desc } from 'drizzle-orm';
import { db, goals } from '@/lib/db';
import { activeGoalsProgress } from '@/lib/goals';
import { GoalsManage } from './goals-manage';

export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const [progress, all] = await Promise.all([
    activeGoalsProgress(),
    db.select().from(goals).orderBy(desc(goals.createdAt)).limit(100),
  ]);
  const inactive = all.filter((g) => g.status !== 'active');

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl italic">Goals</h1>
        <p className="mt-1 text-sm text-moth">
          The top of the pyramid. Progress is measured from your data — never typed in.
        </p>
      </div>
      <GoalsManage
        progress={progress.map((p) => ({
          goal: p.goal,
          current: p.current,
          fraction: p.fraction,
          timeFraction: p.timeFraction,
          onPace: p.onPace,
          line: p.line,
        }))}
        inactive={inactive}
      />
    </main>
  );
}
