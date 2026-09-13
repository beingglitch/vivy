import { Dock } from '@/components/shell';
import { listAreas } from '@/lib/areas';
import { requireUserId } from '@/lib/session';
import { AreasScreen } from './areas-screen';

export const dynamic = 'force-dynamic';

/**
 * Focus areas.
 *
 * Areas group tasks and give each one a cadence, which is what lets Vivy say
 * something has gone quiet rather than just listing what is left.
 */
export default async function AreasPage() {
  const areas = await listAreas(await requireUserId());

  return (
    <>
      <AreasScreen areas={areas} />
      <Dock />
    </>
  );
}
