import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { db, events } from '@/lib/db';
import { verifySessionValue, SESSION_COOKIE } from '@/lib/auth';
import { VIVY_MODEL_FAST } from '@/lib/ai';
import { logMeal, logSleep, MEALS, type Meal } from '@/lib/health';
import { istToday } from '@/lib/routines';

// One endpoint for every spoken capture surface (chat-less): the Android tile
// and anything else that can turn speech into text. Free text in, the right
// event out — Haiku classifies, a keyword fallback keeps it working offline-ish.

const classification = z.object({
  kind: z.enum(['meal', 'sleep', 'wake', 'note']),
  meal: z.enum(MEALS).nullable().describe('only when kind is meal'),
});

function keywordFallback(text: string): z.infer<typeof classification> {
  const t = text.toLowerCase();
  const meal = MEALS.find((m) => t.includes(m));
  if (meal) return { kind: 'meal', meal };
  if (/\b(ate|eating|food|khana|had my)\b/.test(t)) return { kind: 'meal', meal: 'snack' };
  if (/\b(sleep|sleeping|bed|good night|so ja)\b/.test(t)) return { kind: 'sleep', meal: null };
  if (/\b(awake|woke|wake|morning|utha?)\b/.test(t)) return { kind: 'wake', meal: null };
  return { kind: 'note', meal: null };
}

async function classify(text: string): Promise<z.infer<typeof classification>> {
  try {
    const { object } = await generateObject({
      model: VIVY_MODEL_FAST,
      schema: classification,
      system:
        'Classify one spoken life-log line. meal = he ate something (pick which meal from the words ' +
        'or the likely time of day in India); sleep = going to sleep now; wake = just woke up; ' +
        'note = anything else worth keeping.',
      prompt: text,
    });
    return object;
  } catch {
    return keywordFallback(text);
  }
}

export async function POST(req: NextRequest) {
  const keyOk = req.headers.get('x-vivy-key') === process.env.VIVY_INGEST_KEY;
  const sessionOk = await verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value);
  if (!keyOk && !sessionOk) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
  const source = typeof body?.source === 'string' && body.source ? body.source : 'voice';

  const c = await classify(text);
  if (c.kind === 'meal') {
    const logged = await logMeal((c.meal ?? 'snack') as Meal, source, text);
    return NextResponse.json({ logged: 'meal', meal: logged.meal, say: `${logged.meal} logged` });
  }
  if (c.kind === 'sleep' || c.kind === 'wake') {
    const logged = await logSleep(c.kind, source);
    return NextResponse.json({
      logged: logged.kind,
      say: logged.kind === 'sleep' ? 'good night, logged' : 'good morning, logged',
    });
  }
  await db.insert(events).values({
    source,
    type: 'note',
    title: text.slice(0, 120),
    payload: { text, day: istToday() },
  });
  return NextResponse.json({ logged: 'note', say: 'noted' });
}
