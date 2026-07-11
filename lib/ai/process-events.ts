import { generateObject } from 'ai';
import { z } from 'zod';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, events, tasks } from '@/lib/db';
import { VIVY_MODEL_FAST, VIVY_PERSONA } from './index';

// Event types whose content is text worth mining for tasks. Everything else
// (video.watch, page.visit, search…) is analytics — mark processed and move on.
const TEXT_TYPES = new Set(['note', 'meeting.note', 'transcript', 'email', 'text']);

const extractionSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().describe('short imperative task title'),
        detail: z.string().nullable().describe('one-line context, or null'),
        priority: z.number().int().min(1).max(3).describe('1 urgent · 2 normal · 3 low'),
        due: z.string().nullable().describe('YYYY-MM-DD if a real deadline is stated, else null'),
      }),
    )
    .describe('actionable tasks found in the text — empty if there are none'),
});

async function extractTasks(evt: typeof events.$inferSelect) {
  const text = [evt.title, JSON.stringify(evt.payload)].filter(Boolean).join('\n');
  const { object } = await generateObject({
    model: VIVY_MODEL_FAST,
    schema: extractionSchema,
    system:
      VIVY_PERSONA +
      ' Extract ACTIONABLE tasks from the text below. Only real actions I must take — ' +
      'no vague "look into X" unless the text clearly implies it. System/test messages ' +
      '(e.g. "Extension connected") contain no tasks. Today is ' +
      new Date().toISOString().slice(0, 10) +
      '.',
    prompt: `Event (source: ${evt.source}, type: ${evt.type}):\n${text}`,
  });
  return object.tasks;
}

const VIDEO_CATEGORIES = [
  'education',
  'entertainment',
  'music',
  'news',
  'tech',
  'sports',
  'other',
] as const;

const classifySchema = z.object({
  items: z.array(
    z.object({
      index: z.number().int().describe('index of the video in the list'),
      category: z.enum(VIDEO_CATEGORIES),
    }),
  ),
});

// Tag watched videos by what they are — so screen time splits into
// "learning" vs "fun" instead of one opaque number. One batched Haiku call.
async function classifyVideos(videos: (typeof events.$inferSelect)[]) {
  const list = videos
    .map((v, i) => {
      const p = v.payload as Record<string, unknown>;
      return `${i}. "${v.title ?? p.title ?? 'unknown'}" — channel: ${p.channel ?? 'unknown'}`;
    })
    .join('\n');
  const { object } = await generateObject({
    model: VIVY_MODEL_FAST,
    schema: classifySchema,
    system:
      'Classify each watched video into exactly one category. ' +
      'education = tutorials, courses, lectures, documentaries, explainers; ' +
      'entertainment = comedy, sitcoms, vlogs, reactions, movies/TV clips; ' +
      'tech = product reviews, dev talks, tech news. Use your judgment for the rest.',
    prompt: list,
  });
  const byIndex = new Map(object.items.map((i) => [i.index, i.category]));
  for (let i = 0; i < videos.length; i++) {
    const category = byIndex.get(i) ?? 'other';
    await db
      .update(events)
      .set({
        payload: { ...(videos[i].payload as Record<string, unknown>), category },
        processed: true,
      })
      .where(eq(events.id, videos[i].id));
  }
  return videos.length;
}

// The processing loop: unprocessed events → AI handler by type → derived records.
// Called by cron and fire-and-forget after each ingest. Safe to run repeatedly.
export async function processEvents(max = 25) {
  const pending = await db
    .select()
    .from(events)
    .where(eq(events.processed, false))
    .orderBy(asc(events.ts))
    .limit(200);

  const isText = (e: typeof events.$inferSelect) => TEXT_TYPES.has(e.type) && e.source !== 'ai';
  const textEvents = pending.filter(isText).slice(0, max);
  const videoEvents = pending.filter((e) => e.type === 'video.watch').slice(0, 60);
  // "Rest" is pure analytics (page.visit, search, ai-sourced text…) that needs no AI —
  // mark it processed. Text/video events OVER the per-run caps must NOT land here: they
  // stay pending so the next run mines them, instead of being silently dropped.
  const restIds = pending
    .filter((e) => !isText(e) && e.type !== 'video.watch')
    .map((e) => e.id);

  if (restIds.length > 0) {
    await db.update(events).set({ processed: true }).where(inArray(events.id, restIds));
  }

  let proposed = 0;
  let classified = 0;
  const errors: string[] = [];

  if (videoEvents.length > 0) {
    try {
      classified = await classifyVideos(videoEvents);
    } catch (err) {
      // Leave unprocessed; the next run retries.
      errors.push(`classify: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const evt of textEvents) {
    try {
      const found = await extractTasks(evt);
      if (found.length > 0) {
        await db.insert(tasks).values(
          found.map((t) => ({
            title: t.title,
            detail: t.detail,
            priority: t.priority,
            due: t.due,
            sourceEventId: evt.id,
            aiProposed: true,
          })),
        );
        proposed += found.length;
      }
      await db
        .update(events)
        .set({ processed: true })
        .where(and(eq(events.id, evt.id), eq(events.processed, false)));
    } catch (err) {
      // Leave unprocessed so the next run retries (e.g. AI Gateway still blocked).
      errors.push(`${evt.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    scanned: pending.length,
    analyzed: textEvents.length,
    videosClassified: classified,
    markedOnly: restIds.length,
    tasksProposed: proposed,
    errors,
  };
}
