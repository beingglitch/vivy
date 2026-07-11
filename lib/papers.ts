import { eq, inArray } from 'drizzle-orm';
import { generateText } from 'ai';
import { db, papers, topics } from '@/lib/db';
import { VIVY_MODEL_FAST } from '@/lib/ai';

// arXiv Atom feed → entries, parsed with regexes so we carry no XML dependency.

type ArxivEntry = {
  arxivId: string;
  title: string;
  authors: string;
  summary: string;
  url: string;
  published: string;
};

function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export async function fetchArxiv(query: string, max = 8): Promise<ArxivEntry[]> {
  const url =
    'https://export.arxiv.org/api/query?search_query=' +
    encodeURIComponent(query) +
    `&sortBy=submittedDate&sortOrder=descending&max_results=${max}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'vivy-personal-assistant/1.0' } });
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  const xml = await res.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
  return entries
    .map((e) => {
      const tag = (t: string) =>
        (e.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`))?.[1] ?? '').replace(/\s+/g, ' ').trim();
      const idUrl = tag('id'); // http://arxiv.org/abs/2507.01234v1
      const arxivId = idUrl.split('/abs/')[1] ?? '';
      const authors = [...e.matchAll(/<name>([\s\S]*?)<\/name>/g)]
        .map((m) => m[1].trim())
        .slice(0, 4)
        .join(', ');
      return {
        arxivId,
        title: decode(tag('title')),
        authors,
        summary: decode(tag('summary')).slice(0, 600),
        url: idUrl.replace('http://', 'https://'),
        published: tag('published'),
      };
    })
    .filter((e) => e.arxivId && e.title);
}

// Pull fresh candidates for every active topic, let Haiku pick ~3 (active-reading
// topics always keep a suggestion), store them with a why-line. Idempotent per
// arXiv id. Returns how many landed.
export async function fetchAndSuggestPapers(): Promise<{ suggested: number }> {
  const active = await db.select().from(topics).where(eq(topics.active, true));
  if (active.length === 0) return { suggested: 0 };

  const reading = await db
    .select({ topicId: papers.topicId })
    .from(papers)
    .where(inArray(papers.status, ['reading']));
  const readingTopicIds = new Set(reading.map((r) => r.topicId));

  const seen = new Set((await db.select({ arxivId: papers.arxivId }).from(papers)).map((s) => s.arxivId));

  const candidates: (ArxivEntry & { topicId: string; topicName: string })[] = [];
  for (const t of active) {
    try {
      // Newest work + surveys: surveys/tutorials are the readable on-ramp for a
      // beginner (he has read exactly one paper so far).
      const [fresh, surveys] = await Promise.all([
        fetchArxiv(t.query, 6),
        fetchArxiv(`(${t.query}) AND (all:survey OR all:tutorial OR all:introduction)`, 4).catch(() => []),
      ]);
      for (const e of [...surveys, ...fresh]) {
        if (!seen.has(e.arxivId) && !candidates.some((c) => c.arxivId === e.arxivId)) {
          candidates.push({ ...e, topicId: t.id, topicName: t.name });
        }
      }
    } catch {
      // one topic failing (arXiv hiccup) must not kill the run
    }
  }
  if (candidates.length === 0) return { suggested: 0 };

  const mustKeep = active.filter((t) => readingTopicIds.has(t.id)).map((t) => t.name);
  const weights = [...active]
    .sort((a, b) => Number(b.weight) - Number(a.weight))
    .map((t) => `${t.name} (${t.weight})`)
    .join(', ');
  const list = candidates
    .map((c, i) => `${i}. [${c.topicName}] ${c.title} — ${c.summary.slice(0, 240)}`)
    .join('\n');

  const { text } = await generateText({
    model: VIVY_MODEL_FAST,
    system:
      'You curate research papers for one person: an engineer AND entrepreneur who is ' +
      'currently job-hunting, building toward something great, and dead-set on growing ' +
      'his net worth by orders of magnitude. IMPORTANT: he is a paper-reading BEGINNER — ' +
      'the only paper he has finished is "Attention Is All You Need". Strongly prefer ' +
      'surveys, tutorials, and accessible well-written papers over dense bleeding-edge ' +
      'work; one readable classic beats three novelties he will abandon. Pick the papers ' +
      'with the highest leverage he can actually finish. Respond ONLY with a JSON array ' +
      'like [{"i":0,"why":"one sharp simple-English sentence on why HE should read it"}] ' +
      '— no markdown, no prose.',
    prompt:
      `Interest weights (higher = more of it): ${weights}\n` +
      `Topics he is actively reading right now — each MUST get at least one pick if it has a candidate: ${
        mustKeep.join(', ') || 'none'
      }\n` +
      `Pick the best 3 overall (plus extras only if needed to cover the must-keep topics).\n\n` +
      `Candidates:\n${list}`,
  });

  let picks: { i: number; why: string }[] = [];
  try {
    picks = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return { suggested: 0 };
  }

  let suggested = 0;
  for (const p of picks) {
    const c = candidates[p.i];
    if (!c) continue;
    await db
      .insert(papers)
      .values({
        arxivId: c.arxivId,
        topicId: c.topicId,
        title: c.title,
        authors: c.authors,
        summary: c.summary,
        url: c.url,
        published: c.published ? new Date(c.published) : null,
        why: String(p.why ?? '').slice(0, 300),
      })
      .onConflictDoNothing();
    suggested++;
  }
  return { suggested };
}
