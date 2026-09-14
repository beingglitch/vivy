import { Dock } from '@/components/shell';
import { listAreas } from '@/lib/areas';
import { requirePageUserId } from '@/lib/page-session';
import { listTasks } from '@/lib/tasks';
import { AreasScreen } from './areas-screen';

export const dynamic = 'force-dynamic';

/**
 * Focus areas.
 *
 * Areas group tasks and provide the history and open-work view for each part
 * of life.
 */
export default async function AreasPage() {
  const userId = await requirePageUserId();
  const [areas, openTasks, doneTasks] = await Promise.all([
    listAreas(userId),
    listTasks(userId),
    listTasks(userId, 'done'),
  ]);

  return (
    <>
      <AreasScreen areas={areas} openTasks={openTasks} doneTasks={doneTasks} />
      <Dock />
    </>
  );
}
