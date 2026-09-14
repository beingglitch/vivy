import { Dock } from '@/components/shell';
import { listAreas } from '@/lib/areas';
import { listTasks, retireExpired } from '@/lib/tasks';
import { requirePageUserId } from '@/lib/page-session';
import { QuadrantScreen } from './quadrant-screen';

export const dynamic = 'force-dynamic';

/**
 * Quadrant.
 *
 * Open tasks plotted by importance against how long they take, so the thing
 * worth doing next is the one nearest the top left.
 */
export default async function QuadrantPage() {
  const userId = await requirePageUserId();
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  // Before reading, not after: a task whose deadline was the whole point should
  // never appear on the board one render longer than it deserves.
  await retireExpired(userId);

  const [tasks, areas] = await Promise.all([listTasks(userId), listAreas(userId)]);

  return (
    <>
      <QuadrantScreen tasks={tasks} areas={areas} googleMapsApiKey={googleMapsApiKey} />
      <Dock />
    </>
  );
}
