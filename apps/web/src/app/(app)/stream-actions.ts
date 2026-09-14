'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/session';
import type { StreamGraphStyle, StreamPipelineDefinition } from '@/lib/stream-pipeline-shared';
import { createStreamPipeline } from '@/lib/stream-pipelines';

export async function addStreamPipeline(input: {
  name: string;
  colour: string;
  graphStyle: StreamGraphStyle;
  definition: StreamPipelineDefinition;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await createStreamPipeline(await requireUserId(), input);
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not create stream.',
    };
  }
}
