import { Dock } from '@/components/shell';
import { requirePageUserId } from '@/lib/page-session';
import { loadStreams } from '@/lib/streams-data';
import { StreamsScreen } from './streams-screen';

export const dynamic = 'force-dynamic';

/**
 * Home.
 *
 * Reads `metrics_daily`. A new account has none, so this is empty until a
 * collector has pushed something and the rollup has run. Showing example charts
 * instead would mean every number on the opening screen was fiction.
 */
export default async function HomePage() {
  const streams = await loadStreams(await requirePageUserId());
  return (
    <>
      <StreamsScreen streams={streams} />

      <Dock />
    </>
  );
}
