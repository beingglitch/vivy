import { Dock } from '@/components/shell';
import { listAllAreas, listAreas } from '@/lib/areas';
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
  const [areas, allAreas, doneTasks] = await Promise.all([
    listAreas(userId),
    listAllAreas(userId),
    listTasks(userId, 'done'),
  ]);

  return (
    <>
      <AreasScreen areas={areas} allAreas={allAreas} doneTasks={doneTasks} />
      <Dock />
    </>
  );
}
