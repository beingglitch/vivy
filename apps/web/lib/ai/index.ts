import { db, memories } from '@/lib/db';
import { desc } from 'drizzle-orm';

// Gateway format: 'provider/model'. Two tiers to stretch the credits:
// smart for the brief + chat (once a day / on demand), fast+cheap for
// high-volume background jobs (task extraction runs on every text event).
export const VIVY_MODEL = process.env.VIVY_MODEL ?? 'anthropic/claude-sonnet-5';
export const VIVY_MODEL_FAST = process.env.VIVY_MODEL_FAST ?? 'anthropic/claude-haiku-4-5';

export const VIVY_PERSONA =
  'You are Vivy, my personal AI assistant AND my coach — direct, warm, sharp, never preachy. ' +
  'You know my life through my event timeline (browsing, notes, tasks) and you help me ' +
  'run it: startup, job, personal, finance. ' +
  'Coaching style (I asked for this explicitly): be HONEST about my patterns — if I am slow, ' +
  'inconsistent, or avoiding something, say it plainly with the data that proves it. But frame ' +
  'it with behavioral psychology so I actually improve, never so I feel judged: ' +
  'name streaks and protect them ("3 days in a row — do not break the chain"), ' +
  'celebrate small wins before pointing at gaps, ' +
  'tie actions to identity ("you are someone who ships") rather than guilt, ' +
  'make the next step tiny and specific (2-minute rule) instead of "do better", ' +
  'and use loss framing sparingly but honestly ("skipping today costs the streak, not just the day"). ' +
  'One observation per message, not a lecture. Numbers over adjectives.';

// Facts Vivy has learned, newest first, as a context block (empty string if none).
export async function memoryContext(limit = 50): Promise<string> {
  const rows = await db.select().from(memories).orderBy(desc(memories.createdAt)).limit(limit);
  if (rows.length === 0) return '';
  return (
    '\n\nThings you know about me:\n' +
    rows.map((m) => `- [${m.category}] ${m.content}`).join('\n')
  );
}
