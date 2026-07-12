import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db, briefs, events, memories, positions, recurring, tasks, transactions } from '@/lib/db';
import { TX_CATEGORIES, INCOME_CATEGORIES, fmtINR } from '@/lib/finance';

// MCP server (Streamable HTTP, stateless) so claude.ai can connect to Vivy as
// a custom connector. No OAuth: the connector UI can't send custom headers, so
// the URL carries a long secret — POST /api/mcp/<MCP_SECRET>.
// Same store, new interface: every tool reads/writes the one timeline.

export const dynamic = 'force-dynamic';

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

type Json = Record<string, unknown>;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- tools ----------------------------------------------------------------

const TOOLS = [
  {
    name: 'get_finance_summary',
    description:
      "Suraj's money right now: net worth (THE number — the goal is to grow it), what he owns and owes, this month's daily vs recurring spend, and the next-month forecast.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'log_expense',
    description: `Log money Suraj spent, in INR. Categories: ${TX_CATEGORIES.join(', ')}.`,
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'INR, positive' },
        category: { type: 'string', enum: [...TX_CATEGORIES] },
        note: { type: 'string' },
      },
      required: ['amount'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_income',
    description: `Log money Suraj received, in INR. Categories: ${INCOME_CATEGORIES.join(', ')}.`,
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'INR, positive' },
        category: { type: 'string', enum: [...INCOME_CATEGORIES] },
        note: { type: 'string' },
      },
      required: ['amount'],
      additionalProperties: false,
    },
  },
  {
    name: 'recent_transactions',
    description: 'List recent transactions (newest first). Bill payments are marked.',
    inputSchema: {
      type: 'object',
      properties: { days: { type: 'number', description: '1–90, default 7' } },
      additionalProperties: false,
    },
  },
  {
    name: 'add_task',
    description: "Add a task to Suraj's inbox.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        detail: { type: 'string' },
        due: { type: 'string', description: 'YYYY-MM-DD' },
        priority: { type: 'number', description: '1 high · 2 normal · 3 low' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_tasks',
    description: 'List open tasks (inbox, today, doing) with their ids.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'complete_task',
    description: 'Mark a task done by id (get ids from list_tasks).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_memory',
    description: "Save a durable fact about Suraj (Vivy injects these into its AI context). Use for preferences, goals, life facts — not for one-off chatter.",
    inputSchema: {
      type: 'object',
      properties: { content: { type: 'string' } },
      required: ['content'],
      additionalProperties: false,
    },
  },
  {
    name: 'recent_events',
    description:
      "Peek at Suraj's timeline (browsing, learning logs, AI notes — everything is an event). Optionally filter by type.",
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: '1–30, default 2' },
        type: { type: 'string', description: "e.g. 'video.watch', 'learning.log', 'ai.daily-minute'" },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_daily_brief',
    description: "Vivy's latest morning brief — what Suraj should do today.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
] as const;

async function runTool(name: string, args: Json): Promise<string> {
  switch (name) {
    case 'get_finance_summary': {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [pos, rec, month] = await Promise.all([
        db.select().from(positions),
        db.select().from(recurring).where(eq(recurring.active, true)),
        db
          .select({
            daily: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.recurringId} is null and ${transactions.type} = 'expense'), 0)`,
            bills: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.recurringId} is not null and ${transactions.type} = 'expense'), 0)`,
            income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`,
          })
          .from(transactions)
          .where(gte(transactions.ts, monthStart)),
      ]);
      const own = pos
        .filter((p) => p.kind === 'asset' && p.consider)
        .reduce((s, p) => s + Number(p.value), 0);
      const owe = pos
        .filter((p) => p.kind === 'liability' && p.consider)
        .reduce((s, p) => s + Number(p.value), 0);
      const recExp = rec.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
      const recInc = rec.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
      const daily = Number(month[0]?.daily ?? 0);
      const bills = Number(month[0]?.bills ?? 0);
      const lines = [
        `Net worth: ${own - owe < 0 ? '−' : ''}${fmtINR(Math.abs(own - owe))} (own ${fmtINR(own)}, owe ${fmtINR(owe)})`,
        `This month: ${fmtINR(daily)} daily + ${fmtINR(bills)} bills = ${fmtINR(daily + bills)} out · ${fmtINR(Number(month[0]?.income ?? 0))} in`,
        `Recurring: ${fmtINR(bills)} settled of ${fmtINR(recExp)}/mo expenses · ${fmtINR(recInc)}/mo income`,
        `Positions:`,
        ...pos.map(
          (p) =>
            `  ${p.kind === 'asset' ? '+' : '−'} ${p.name}: ${fmtINR(Number(p.value))}${p.consider ? '' : ' (not counted)'}${p.nextOutflow ? ` · ${fmtINR(Number(p.nextOutflow))} planned next month` : ''}`,
        ),
      ];
      return lines.join('\n');
    }
    case 'log_expense':
    case 'log_income': {
      const amount = Number(args.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be a positive number (INR)');
      const type = name === 'log_income' ? 'income' : 'expense';
      const [row] = await db
        .insert(transactions)
        .values({
          amount: amount.toFixed(2),
          type,
          category: typeof args.category === 'string' ? args.category : 'other',
          note: typeof args.note === 'string' ? args.note : null,
          source: 'mcp',
        })
        .returning();
      return `Saved: ${type === 'income' ? '+' : ''}${fmtINR(amount)} · ${row.category}${row.note ? ` · ${row.note}` : ''}`;
    }
    case 'recent_transactions': {
      const days = Math.min(Math.max(Number(args.days) || 7, 1), 90);
      const rows = await db
        .select()
        .from(transactions)
        .where(gte(transactions.ts, new Date(Date.now() - days * 86400000)))
        .orderBy(desc(transactions.ts))
        .limit(200);
      if (rows.length === 0) return `No transactions in the last ${days} day(s).`;
      return rows
        .map(
          (t) =>
            `${t.ts.toISOString().slice(0, 10)} ${t.type === 'income' ? '+' : '−'}${fmtINR(Number(t.amount))} ${t.category}${t.recurringId ? ' [bill]' : ''}${t.note ? ` · ${t.note}` : ''}`,
        )
        .join('\n');
    }
    case 'add_task': {
      const title = typeof args.title === 'string' ? args.title.trim() : '';
      if (!title) throw new Error('title required');
      const [row] = await db
        .insert(tasks)
        .values({
          title,
          detail: typeof args.detail === 'string' ? args.detail : null,
          due: typeof args.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.due) ? args.due : null,
          priority: [1, 2, 3].includes(Number(args.priority)) ? Number(args.priority) : 2,
        })
        .returning();
      return `Task added: "${row.title}" (id ${row.id})`;
    }
    case 'list_tasks': {
      const rows = await db
        .select()
        .from(tasks)
        .where(sql`${tasks.status} in ('inbox','today','doing')`)
        .orderBy(tasks.priority, desc(tasks.createdAt))
        .limit(50);
      if (rows.length === 0) return 'No open tasks.';
      return rows
        .map((t) => `[${t.status}] ${t.title}${t.due ? ` (due ${t.due})` : ''} · id ${t.id}`)
        .join('\n');
    }
    case 'complete_task': {
      const id = typeof args.id === 'string' ? args.id : '';
      const [row] = await db
        .update(tasks)
        .set({ status: 'done', completedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning();
      if (!row) throw new Error('no task with that id');
      return `Done: "${row.title}"`;
    }
    case 'add_memory': {
      const content = typeof args.content === 'string' ? args.content.trim() : '';
      if (!content) throw new Error('content required');
      await db.insert(memories).values({ content });
      return 'Remembered.';
    }
    case 'recent_events': {
      const days = Math.min(Math.max(Number(args.days) || 2, 1), 30);
      const conds = [gte(events.ts, new Date(Date.now() - days * 86400000))];
      if (typeof args.type === 'string' && args.type) conds.push(eq(events.type, args.type));
      const rows = await db
        .select({ ts: events.ts, source: events.source, type: events.type, title: events.title })
        .from(events)
        .where(and(...conds))
        .orderBy(desc(events.ts))
        .limit(100);
      if (rows.length === 0) return `No events in the last ${days} day(s).`;
      return rows
        .map((e) => `${e.ts.toISOString().slice(0, 16).replace('T', ' ')} [${e.source}/${e.type}] ${e.title ?? ''}`)
        .join('\n');
    }
    case 'get_daily_brief': {
      const [brief] = await db.select().from(briefs).orderBy(desc(briefs.day)).limit(1);
      if (!brief) return 'No brief yet.';
      return `Brief for ${brief.day}:\n\n${brief.content}`;
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

// ---- JSON-RPC plumbing ------------------------------------------------------

function rpcResult(id: unknown, result: Json) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handleMessage(msg: Json): Promise<Json | null> {
  const { id, method, params } = msg as { id?: unknown; method?: string; params?: Json };
  if (typeof method !== 'string') return rpcError(id ?? null, -32600, 'invalid request');
  // Notifications (no id) get no response.
  if (id === undefined) return null;

  try {
    switch (method) {
      case 'initialize': {
        const asked = (params?.protocolVersion as string) ?? '';
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'vivy', version: '1.0.0' },
          instructions:
            "Vivy is Suraj Shukla's personal assistant app: one timeline of events, tasks, finances (net worth is THE number), and learning. Use the tools to read his state or log things for him.",
        });
      }
      case 'ping':
        return rpcResult(id, {});
      case 'tools/list':
        return rpcResult(id, { tools: TOOLS });
      case 'tools/call': {
        const name = params?.name as string;
        const args = (params?.arguments as Json) ?? {};
        try {
          const text = await runTool(name, args);
          return rpcResult(id, { content: [{ type: 'text', text }] });
        } catch (e) {
          return rpcResult(id, {
            content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
            isError: true,
          });
        }
      }
      // Declared capability is tools-only, but answer these politely anyway.
      case 'resources/list':
        return rpcResult(id, { resources: [] });
      case 'resources/templates/list':
        return rpcResult(id, { resourceTemplates: [] });
      case 'prompts/list':
        return rpcResult(id, { prompts: [] });
      default:
        return rpcError(id, -32601, `method not found: ${method}`);
    }
  } catch (e) {
    return rpcError(id, -32603, e instanceof Error ? e.message : 'internal error');
  }
}

function authorized(secret: string): boolean {
  // Forgive the usual `vercel env add` paste accidents: surrounding quotes,
  // stray whitespace, or the whole `MCP_SECRET=...` line.
  const expected = (process.env.MCP_SECRET ?? '')
    .trim()
    .replace(/^MCP_SECRET=/, '')
    .replace(/^["']|["']$/g, '');
  return expected.length >= 24 && timingSafeEqual(secret, expected);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  if (!authorized(secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json(rpcError(null, -32700, 'parse error'), { status: 400 });

  // Batches exist pre-2025-06-18; handle both shapes.
  const messages = Array.isArray(body) ? body : [body];
  const responses = (await Promise.all(messages.map((m) => handleMessage(m as Json)))).filter(
    (r): r is Json => r !== null,
  );

  if (responses.length === 0) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? responses : responses[0]);
}

// Stateless server: no SSE stream to resume, no session to delete.
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}
export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}
