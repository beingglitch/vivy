import { Dock } from '@/components/shell';
import { listAreas } from '@/lib/areas';
import { requirePageUserId } from '@/lib/page-session';
import { AreasScreen } from './areas-screen';

export const dynamic = 'force-dynamic';

/**
 * Focus areas.
 *
 * Areas group tasks and give each one a cadence, which is what lets Vivy say
 * something has gone quiet rather than just listing what is left.
 */
export default async function AreasPage() {
  const areas = await listAreas(await requirePageUserId());

  return (
    <>
      <AreasScreen areas={areas} />
      <Dock />
    </>
  );
}
