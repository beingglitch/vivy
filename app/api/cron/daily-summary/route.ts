import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { db, events } from '@/lib/db';
import { browsingStats, fmtDuration } from '@/lib/browsing';
import { snapshotNetWorth } from '@/lib/networth';
import { fetchAndSuggestPapers } from '@/lib/papers';
import { VIVY_MODEL_FAST } from '@/lib/ai';

export const maxDuration = 120;

// Runs every morning (Vercel Cron). Reads yesterday's browsing, writes an
// ai.daily-summary event with takeaways + screen-time suggestions.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Piggy-back daily jobs on this cron (Hobby plan cron quota): the net-worth
  // snapshot and the day's research-paper suggestions.
  await snapshotNetWorth().catch(() => {});
  const papersRun = await fetchAndSuggestPapers().catch(() => ({ suggested: -1 }));

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stats = await browsingStats(since);

  if (stats.videos.length === 0 && stats.searches.length === 0 && stats.domains.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'no browser events in last 24h', papers: papersRun });
  }

  const digest = [
    `Videos watched (${stats.videos.length}, total ${fmtDuration(stats.totalVideoSeconds)}):`,
    ...stats.videos.slice(0, 30).map((v) => `- ${v.title} [${v.channel}] — ${fmtDuration(v.seconds)}`),
    `\nSearches (${stats.searches.length}):`,
    ...stats.searches.slice(0, 50).map((s) => `- "${s.query}" (${s.engine})`),
    `\nTime by site (total ${fmtDuration(stats.totalBrowseSeconds)}):`,
    ...stats.domains.slice(0, 20).map((d) => `- ${d.domain}: ${fmtDuration(d.seconds)}`),
  ].join('\n');

  const { text } = await generateText({
    model: VIVY_MODEL_FAST,
    system:
      'You are Vivy, my personal assistant. You are direct, warm, and useful — never preachy. ' +
      'Given my last 24h of browsing, write a short markdown summary with sections: ' +
      '**What you explored** (themes from videos+searches, 2-4 bullets — infer what I was trying to learn or do), ' +
      '**Worth noting** (anything that looks like a task, decision, or thing to follow up — be concrete), ' +
      '**Screen time** (one honest observation + one specific suggestion for tomorrow, with numbers). ' +
      'Keep the whole thing under 200 words.',
    prompt: digest,
  });

  const [row] = await db
    .insert(events)
    .values({
      source: 'ai',
      type: 'ai.daily-summary',
      title: `Browsing summary — ${new Date().toISOString().slice(0, 10)}`,
      payload: { summary: text },
    })
    .returning({ id: events.id });

  return NextResponse.json({ ok: true, id: row.id, summary: text });
}
