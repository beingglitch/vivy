import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  date,
  index,
  numeric,
} from 'drizzle-orm/pg-core';

// The one timeline. Every ingestor (browser extension, screen agent, finance,
// recorder hardware) writes here; AI jobs read from here.
export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    source: text('source').notNull(), // 'browser' | 'screen-agent' | 'chat' | 'ai' | 'manual' ...
    type: text('type').notNull(), // 'video.watch' | 'search' | 'page.visit' | 'note' | 'ai.daily-summary' ...
    title: text('title'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    processed: boolean('processed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('events_ts_idx').on(t.ts),
    index('events_type_idx').on(t.type),
    index('events_source_idx').on(t.source),
  ],
);

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(), // 'startup' | 'job' | 'personal' | 'finance'
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    detail: text('detail'),
    status: text('status').notNull().default('inbox'), // 'inbox' | 'today' | 'doing' | 'done' | 'dropped'
    priority: integer('priority').notNull().default(2), // 1 high · 2 normal · 3 low
    due: date('due'),
    projectId: uuid('project_id').references(() => projects.id),
    sourceEventId: uuid('source_event_id').references(() => events.id),
    aiProposed: boolean('ai_proposed').notNull().default(false), // true until I approve it
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('tasks_status_idx').on(t.status)],
);

// One row per morning "do this today" plan.
export const briefs = pgTable('briefs', {
  id: uuid('id').defaultRandom().primaryKey(),
  day: date('day').notNull().unique(),
  content: text('content').notNull(), // markdown
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Facts Vivy learns about me; injected into AI context.
export const memories = pgTable('memories', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: text('content').notNull(),
  category: text('category').notNull().default('general'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Books AND courses — same lifecycle (backlog → active → done), same coach.
// Progress logs are events (type 'learning.log'); unitsDone is the cached total.
export const learning = pgTable('learning', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: text('kind').notNull(), // 'book' | 'course'
  title: text('title').notNull(),
  author: text('author'), // author (book) or platform/provider (course)
  url: text('url'),
  status: text('status').notNull().default('backlog'), // 'backlog' | 'active' | 'done' | 'dropped'
  unitName: text('unit_name').notNull().default('chapter'), // 'chapter' | 'lesson' | 'page' | 'hour'
  unitsTotal: integer('units_total'),
  unitsDone: integer('units_done').notNull().default(0),
  startedAt: date('started_at'),
  finishedAt: date('finished_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Money movements. Manual + chat entry now (interim); SMS/Gmail/bank ingestors
// (Epic 3) will write the same rows with source set accordingly.
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(), // INR
    type: text('type').notNull().default('expense'), // 'expense' | 'income'
    category: text('category').notNull().default('other'),
    note: text('note'),
    source: text('source').notNull().default('manual'), // 'manual' | 'chat' | 'sms' | 'gmail' | 'bank'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('transactions_ts_idx').on(t.ts)],
);

// Net-worth line items — what I own and owe, current value edited in place.
// Manual for now (same interim fallback as manual transactions); bank/broker
// ingestors will update the same rows later.
export const positions = pgTable('positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: text('kind').notNull(), // 'asset' | 'liability'
  name: text('name').notNull(),
  category: text('category').notNull().default('other'), // 'cash' | 'bank' | 'investment' | 'property' | 'loan' | 'credit' | 'other'
  value: numeric('value', { precision: 14, scale: 2 }).notNull(), // INR
  note: text('note'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Recurring money rules (rent, salary, subscriptions). The forecast reads these;
// actual payments still land in `transactions` when they happen.
export const recurring = pgTable('recurring', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(), // INR per month
  type: text('type').notNull().default('expense'), // 'expense' | 'income'
  category: text('category').notNull().default('bills'),
  dayOfMonth: integer('day_of_month'), // when it usually hits (1–31), optional
  active: boolean('active').notNull().default(true),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
