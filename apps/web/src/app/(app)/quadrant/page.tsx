import { Dock } from '@/components/shell';
import { listAreas } from '@/lib/areas';
import { listTasks } from '@/lib/tasks';
import { requireUserId } from '@/lib/session';
import { QuadrantScreen } from './quadrant-screen';

export const dynamic = 'force-dynamic';

/**
 * Quadrant.
 *
 * Open tasks plotted by importance against how long they take, so the thing
 * worth doing next is the one nearest the top left.
 */
export default async function QuadrantPage() {
  const userId = await requireUserId();
  const [tasks, areas] = await Promise.all([listTasks(userId), listAreas(userId)]);

  return (
    <>
      <QuadrantScreen tasks={tasks} areas={areas} />
      <Dock />
    </>
  );
}
