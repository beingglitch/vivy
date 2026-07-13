import { and, desc, eq, gte } from 'drizzle-orm';
import { generateText } from 'ai';
import { db, events, topics } from '@/lib/db';
import { VIVY_MODEL_FAST } from '@/lib/ai';

// The one-minute daily card: a simple English word with a usage scenario, three
// news highlights near his topics (real Hacker News stories, not model memory),
// and a micro-bio of someone/something worth knowing. Everything in plain,
// simple English — he is not fluent yet, and each block must read in under a
// minute. Stored as an ai.daily-minute event (everything is an event).

export type DailyMinute = {
  word: { word: string; meaning: string; scenario: string; grammar: string };
  news: { title: string; note: string; url: string }[];
  bio: { name: string; who: string; why: string };
};

function istDay(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

async function topHackerNews(n = 25): Promise<{ title: string; url: string }[]> {
  const ids: number[] = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json').then((r) =>
    r.json(),
  );
  const items = await Promise.all(
    ids.slice(0, n).map((id) =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then((r) => r.json())
        .catch(() => null),
    ),
  );
  return items
    .filter((i): i is { id: number; title: string; url?: string } => Boolean(i?.title))
    .map((i) => ({ title: i.title, url: i.url ?? `https://news.ycombinator.com/item?id=${i.id}` }));
}

export async function generateDailyMinute(): Promise<{ ok: boolean; skipped?: string }> {
  const day = istDay();
  const [existing] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.type, 'ai.daily-minute'), eq(events.title, `Daily minute — ${day}`)))
    .limit(1);
  if (existing) return { ok: true, skipped: 'already generated today' };

  const [active, stories, recent] = await Promise.all([
    db.select({ name: topics.name }).from(topics).where(eq(topics.active, true)),
    topHackerNews().catch(() => [] as { title: string; url: string }[]),
    // last 2 weeks of cards so words and bios don't repeat
    db
      .select({ payload: events.payload })
      .from(events)
      .where(
        and(eq(events.type, 'ai.daily-minute'), gte(events.ts, new Date(Date.now() - 14 * 86400000))),
      )
      .orderBy(desc(events.ts))
      .limit(14),
  ]);

  const usedWords = recent.map((r) => (r.payload as { word?: { word?: string } }).word?.word).filter(Boolean);
  const usedBios = recent.map((r) => (r.payload as { bio?: { name?: string } }).bio?.name).filter(Boolean);
  const storyList = stories.map((s, i) => `${i}. ${s.title}`).join('\n');

  const { text } = await generateText({
    model: VIVY_MODEL_FAST,
    system:
      'You write a tiny daily learning card for one person: an engineer-entrepreneur in ' +
      'India, job-hunting, building toward a huge net worth. His English is not fluent — ' +
      'use SIMPLE English everywhere. Each block must be readable in under a minute. ' +
      'Respond ONLY with JSON, no markdown fences: ' +
      '{"word":{"word":"...","meaning":"plain one-line meaning","scenario":"one short real-life sentence using it correctly, from his world (work, money, startups)","grammar":"one short note: part of speech + how to use it right"},' +
      '"news":[{"i":<story index>,"note":"one simple sentence: what it is and why he should care"} x3],' +
      '"bio":{"name":"...","who":"one sentence: who/what this is","why":"two short sentences: what they did and the lesson for him"}}',
    prompt:
      `His interest topics: ${active.map((t) => t.name).join(', ') || 'tech, startups'}.\n` +
      `Words already used (pick a NEW useful everyday-professional word): ${usedWords.join(', ') || 'none'}\n` +
      `Bios already used (pick someone/something NEW — founder, scientist, company, concept): ${usedBios.join(', ') || 'none'}\n` +
      `Today's top Hacker News stories (pick the 3 closest to his topics):\n${storyList || '(none available — return "news": [])'}`,
  });

  let parsed: {
    word: DailyMinute['word'];
    news: { i: number; note: string }[];
    bio: DailyMinute['bio'];
  };
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return { ok: false, skipped: 'model returned unparseable JSON' };
  }

  const minute: DailyMinute = {
    word: parsed.word,
    news: (parsed.news ?? [])
      .map((n) => ({ title: stories[n.i]?.title ?? '', note: n.note, url: stories[n.i]?.url ?? '' }))
      .filter((n) => n.title && n.url)
      .slice(0, 3),
    bio: parsed.bio,
  };

  await db.insert(events).values({
    source: 'ai',
    type: 'ai.daily-minute',
    title: `Daily minute — ${day}`,
    payload: minute as unknown as Record<string, unknown>,
    processed: true, // nothing downstream needs to process this
  });
  return { ok: true };
}
