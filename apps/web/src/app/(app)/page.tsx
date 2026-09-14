import { Dock } from '@/components/shell';
import { requirePageUserId } from '@/lib/page-session';
import { loadStreamPipelineOptions } from '@/lib/stream-pipelines';
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
  const userId = await requirePageUserId();
  const [streams, pipelineOptions] = await Promise.all([
    loadStreams(userId),
    loadStreamPipelineOptions(userId),
  ]);
  return (
    <>
      <StreamsScreen streams={streams} pipelineOptions={pipelineOptions} />

      <Dock />
    </>
  );
}
