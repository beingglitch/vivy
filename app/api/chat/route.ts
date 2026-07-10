import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { z } from 'zod';
import { and, desc, eq, gte, ilike, inArray, ne, sql } from 'drizzle-orm';
import { db, chatMessages, events, learning, memories, tasks, transactions } from '@/lib/db';
import { VIVY_MODEL, VIVY_PERSONA, memoryContext } from '@/lib/ai';
import { logLearningProgress } from '@/lib/learning';
import { TX_CATEGORIES } from '@/lib/finance';

export const maxDuration = 120;

const vivyTools = {
  queryTasks: tool({
    description: 'List my tasks, optionally filtered by status (inbox|today|doing|done|dropped).',
    inputSchema: z.object({ status: z.string().nullable() }),
    execute: async ({ status }) => {
      const rows = await db
        .select()
        .from(tasks)
        .where(
          status
            ? eq(tasks.status, status)
            : inArray(tasks.status, ['inbox', 'today', 'doing']),
        )
        .orderBy(tasks.priority, desc(tasks.createdAt))
        .limit(50);
      return rows.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due: t.due,
        aiProposed: t.aiProposed,
      }));
    },
  }),

  createTask: tool({
    description: 'Create a task for me.',
    inputSchema: z.object({
      title: z.string(),
      detail: z.string().nullable(),
      priority: z.number().int().min(1).max(3).describe('1 urgent · 2 normal · 3 low'),
      due: z.string().nullable().describe('YYYY-MM-DD or null'),
    }),
    execute: async ({ title, detail, priority, due }) => {
      const [row] = await db
        .insert(tasks)
        .values({ title, detail, priority, due, status: 'inbox' })
        .returning();
      return { created: row.id, title: row.title };
    },
  }),

  completeTask: tool({
    description: 'Mark a task done. Pass the task id from queryTasks, or a title fragment.',
    inputSchema: z.object({
      id: z.string().nullable().describe('task uuid if known'),
      titleContains: z.string().nullable().describe('fallback: unique fragment of the title'),
    }),
    execute: async ({ id, titleContains }) => {
      const where = id
        ? eq(tasks.id, id)
        : titleContains
          ? and(ilike(tasks.title, `%${titleContains}%`), inArray(tasks.status, ['inbox', 'today', 'doing']))
          : null;
      if (!where) return { error: 'need id or titleContains' };
      const rows = await db
        .update(tasks)
        .set({ status: 'done', completedAt: new Date() })
        .where(where)
        .returning();
      if (rows.length === 0) return { error: 'no matching open task' };
      return { done: rows.map((t) => t.title) };
    },
  }),

  queryEvents: tool({
    description:
      'Search my life timeline (browsing, videos, searches, notes). Filter by source/type/hours back.',
    inputSchema: z.object({
      source: z.string().nullable().describe('e.g. browser, ai, chat'),
      type: z.string().nullable().describe('e.g. video.watch, search, page.visit, note'),
      hoursBack: z.number().int().min(1).max(720),
      limit: z.number().int().min(1).max(100),
    }),
    execute: async ({ source, type, hoursBack, limit }) => {
      const conds = [gte(events.ts, new Date(Date.now() - hoursBack * 3600 * 1000))];
      if (source) conds.push(eq(events.source, source));
      if (type) conds.push(eq(events.type, type));
      const rows = await db
        .select()
        .from(events)
        .where(and(...conds))
        .orderBy(desc(events.ts))
        .limit(limit);
      return rows.map((e) => ({
        ts: e.ts,
        source: e.source,
        type: e.type,
        title: e.title,
        payload: e.payload,
      }));
    },
  }),

  logLearning: tool({
    description:
      'Log reading/course progress, e.g. "I read 5 chapters of Einstein". Matches the book/course by title fragment.',
    inputSchema: z.object({
      titleContains: z.string().describe('unique fragment of the book/course title'),
      units: z.number().int().min(1).describe('chapters/lessons completed'),
      note: z.string().nullable(),
    }),
    execute: async ({ titleContains, units, note }) => {
      const matches = await db
        .select()
        .from(learning)
        .where(and(ilike(learning.title, `%${titleContains}%`), ne(learning.status, 'dropped')))
        .limit(3);
      if (matches.length === 0) return { error: `no book/course matching "${titleContains}" — offer to add it` };
      if (matches.length > 1) return { error: 'ambiguous', candidates: matches.map((m) => m.title) };
      const item = await logLearningProgress(matches[0].id, units, note, 'chat');
      return {
        logged: units,
        title: item!.title,
        progress: `${item!.unitsDone}${item!.unitsTotal ? '/' + item!.unitsTotal : ''} ${item!.unitName}s`,
        status: item!.status,
      };
    },
  }),

  addLearning: tool({
    description: 'Add a new book or course to track.',
    inputSchema: z.object({
      kind: z.enum(['book', 'course']),
      title: z.string(),
      author: z.string().nullable().describe('author (book) or platform (course)'),
      unitsTotal: z.number().int().nullable().describe('total chapters/lessons if known'),
    }),
    execute: async ({ kind, title, author, unitsTotal }) => {
      const [row] = await db
        .insert(learning)
        .values({ kind, title, author, unitsTotal, unitName: kind === 'book' ? 'chapter' : 'lesson' })
        .returning();
      return { added: row.title, kind: row.kind };
    },
  }),

  logExpense: tool({
    description:
      'Record money spent (or received), e.g. "spent 250 on lunch". Amount in INR.',
    inputSchema: z.object({
      amount: z.number().positive(),
      category: z.enum(TX_CATEGORIES),
      note: z.string().nullable(),
      type: z.enum(['expense', 'income']),
    }),
    execute: async ({ amount, category, note, type }) => {
      const [row] = await db
        .insert(transactions)
        .values({ amount: amount.toFixed(2), category, note, type, source: 'chat' })
        .returning();
      return { saved: `₹${row.amount}`, category: row.category, type: row.type };
    },
  }),

  queryFinance: tool({
    description: 'Spending summary: totals by category over the last N days.',
    inputSchema: z.object({ daysBack: z.number().int().min(1).max(365) }),
    execute: async ({ daysBack }) => {
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      const rows = await db
        .select({
          category: transactions.category,
          type: transactions.type,
          total: sql<string>`sum(${transactions.amount})`,
          count: sql<number>`count(*)`,
        })
        .from(transactions)
        .where(gte(transactions.ts, since))
        .groupBy(transactions.category, transactions.type)
        .orderBy(sql`3 desc`);
      return rows;
    },
  }),

  queryLearning: tool({
    description: 'List my books and courses with progress and status.',
    inputSchema: z.object({ kind: z.enum(['book', 'course']).nullable() }),
    execute: async ({ kind }) => {
      const rows = await db
        .select()
        .from(learning)
        .where(kind ? and(eq(learning.kind, kind), ne(learning.status, 'dropped')) : ne(learning.status, 'dropped'))
        .orderBy(desc(learning.createdAt))
        .limit(50);
      return rows.map((r) => ({
        title: r.title,
        kind: r.kind,
        status: r.status,
        progress: `${r.unitsDone}${r.unitsTotal ? '/' + r.unitsTotal : ''} ${r.unitName}s`,
        startedAt: r.startedAt,
      }));
    },
  }),

  remember: tool({
    description:
      'Store a lasting fact about me (preference, person, goal, constraint). Use when I tell you something worth keeping.',
    inputSchema: z.object({
      fact: z.string(),
      category: z.string().describe('general | preference | person | goal | finance'),
    }),
    execute: async ({ fact, category }) => {
      await db.insert(memories).values({ content: fact, category });
      return { remembered: fact };
    },
  }),
};

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Persist the user's message (the timeline habit: chat is data too).
  const last = messages[messages.length - 1];
  const lastText =
    last?.role === 'user'
      ? last.parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text)
          .join('')
      : '';
  if (lastText) {
    await db.insert(chatMessages).values({ role: 'user', content: lastText });
  }

  const memory = await memoryContext();

  const result = streamText({
    model: VIVY_MODEL,
    system:
      VIVY_PERSONA +
      ` Today is ${new Date().toISOString().slice(0, 10)}. ` +
      'Use your tools to answer from real data instead of guessing. When I mention ' +
      'something I need to do, offer to create the task. Keep replies tight.' +
      memory,
    messages: await convertToModelMessages(messages),
    tools: vivyTools,
    stopWhen: stepCountIs(8),
    onFinish: async ({ text }) => {
      if (text) await db.insert(chatMessages).values({ role: 'assistant', content: text });
    },
  });

  return result.toUIMessageStreamResponse();
}

// Chat history for the UI (last 100 messages, oldest first).
export async function GET() {
  const rows = await db
    .select()
    .from(chatMessages)
    .orderBy(desc(chatMessages.createdAt))
    .limit(100);
  return Response.json({ messages: rows.reverse() });
}
