import { and, desc, eq, ne } from 'drizzle-orm';
import { db, events, learning, papers, topics } from '@/lib/db';
import type { DailyMinute } from '@/lib/daily-minute';
import { LearningList } from './learning-list';
import { PapersPanel } from './papers-panel';

export const dynamic = 'force-dynamic';

export default async function LearningPage() {
  const [rows, suggested, allTopics, minuteRows] = await Promise.all([
    db
      .select()
      .from(learning)
      .where(ne(learning.status, 'dropped'))
      .orderBy(desc(learning.createdAt))
      .limit(200),
    db
      .select({
        id: papers.id,
        title: papers.title,
        authors: papers.authors,
        url: papers.url,
        why: papers.why,
        topicName: topics.name,
      })
      .from(papers)
      .leftJoin(topics, eq(papers.topicId, topics.id))
      .where(eq(papers.status, 'suggested'))
      .orderBy(desc(papers.suggestedAt))
      .limit(12),
    db.select().from(topics).orderBy(desc(topics.weight)),
    db
      .select({ payload: events.payload, title: events.title })
      .from(events)
      .where(and(eq(events.type, 'ai.daily-minute'), eq(events.source, 'ai')))
      .orderBy(desc(events.ts))
      .limit(1),
  ]);

  const minute = (minuteRows[0]?.payload ?? null) as DailyMinute | null;

  return (
    <main className="space-y-8">
      <div>
        <h1 className="font-voice text-2xl italic">Learning</h1>
        <p className="mt-1 text-sm text-moth">
          Books, courses, and papers — logged one session at a time.
        </p>
      </div>
      {minute && (
        <section className="rounded-xl border border-seam bg-veil/50 p-4">
          <h2 className="mb-3 text-xs font-medium tracking-widest text-moth uppercase">
            One minute · word, news, a life
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {minute.word && (
              <div className="space-y-1 text-sm">
                <p className="text-linen">
                  <span className="font-voice text-base text-ember italic">{minute.word.word}</span>
                  <span className="text-moth"> — {minute.word.meaning}</span>
                </p>
                <p className="text-xs text-linen/85 italic">“{minute.word.scenario}”</p>
                <p className="text-[11px] text-moth/80">{minute.word.grammar}</p>
              </div>
            )}
            {minute.news?.length > 0 && (
              <ul className="space-y-2">
                {minute.news.map((n) => (
                  <li key={n.url} className="text-xs leading-snug">
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-linen/95 transition-colors hover:text-ember"
                    >
                      {n.title} <span className="text-moth/70">↗</span>
                    </a>
                    <p className="text-moth">{n.note}</p>
                  </li>
                ))}
              </ul>
            )}
            {minute.bio && (
              <div className="space-y-1 text-xs leading-snug">
                <p className="font-voice text-sm text-linen italic">{minute.bio.name}</p>
                <p className="text-moth">{minute.bio.who}</p>
                <p className="text-linen/85">{minute.bio.why}</p>
              </div>
            )}
          </div>
        </section>
      )}
      <PapersPanel
        suggestions={suggested}
        topics={allTopics.map((t) => ({
          id: t.id,
          name: t.name,
          weight: t.weight,
          active: t.active,
        }))}
      />
      <LearningList
        initial={rows.map((r) => ({
          id: r.id,
          kind: r.kind as 'book' | 'course' | 'paper',
          title: r.title,
          author: r.author,
          status: r.status,
          unitName: r.unitName,
          unitsTotal: r.unitsTotal,
          unitsDone: r.unitsDone,
          startedAt: r.startedAt,
        }))}
      />
    </main>
  );
}
