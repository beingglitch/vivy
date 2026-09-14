import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, gte, inArray, isNull } from 'drizzle-orm';
import { accounts, areas, db, streamPipelines, tasks } from '@vivy/db';
import { getMoneyDashboard } from './money';
import {
  STREAM_COLOURS,
  STREAM_GRAPH_STYLES,
  type StreamGraphStyle,
  type StreamPipelineDefinition,
  type StreamPipelineOptions,
} from './stream-pipeline-shared';

export interface CustomStreamRow {
  key: string;
  name: string;
  dot: string;
  unit: string;
  kind: 'custom';
  graphStyle: StreamGraphStyle;
  dates: string[];
  values: number[];
}

export async function loadStreamPipelineOptions(userId: string): Promise<StreamPipelineOptions> {
  const [accountRows, areaRows] = await Promise.all([
    db()
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
      .orderBy(asc(accounts.createdAt)),
    db()
      .select({ id: areas.id, name: areas.name })
      .from(areas)
      .where(and(eq(areas.userId, userId), isNull(areas.archivedAt)))
      .orderBy(asc(areas.sortOrder), asc(areas.createdAt)),
  ]);
  return { accounts: accountRows, areas: areaRows };
}

export async function loadCustomStreams(
  userId: string,
  dates: string[],
): Promise<CustomStreamRow[]> {
  const pipelines = await db()
    .select()
    .from(streamPipelines)
    .where(and(eq(streamPipelines.userId, userId), isNull(streamPipelines.archivedAt)))
    .orderBy(asc(streamPipelines.createdAt));
  if (pipelines.length === 0) return [];

  const definitions = pipelines.map((pipeline) => parseDefinition(pipeline.definition));
  const needsMoney = definitions.some(
    (definition) =>
      definition.source === 'account-balances' || definition.source === 'transactions',
  );
  const needsTasks = definitions.some((definition) => definition.source === 'completed-tasks');
  const [money, completed] = await Promise.all([
    needsMoney ? getMoneyDashboard(userId) : null,
    needsTasks
      ? db()
          .select({ areaId: tasks.areaId, completedAt: tasks.completedAt })
          .from(tasks)
          .where(
            and(
              eq(tasks.userId, userId),
              eq(tasks.status, 'done'),
              gte(tasks.completedAt, new Date(`${dates[0]}T00:00:00`)),
            ),
          )
      : [],
  ]);

  return pipelines.map((pipeline, index) => {
    const definition = definitions[index]!;
    return {
      key: pipeline.key,
      name: pipeline.name,
      dot: pipeline.colour,
      unit: pipeline.unit,
      kind: 'custom',
      graphStyle: validGraphStyle(pipeline.graphStyle),
      dates,
      values: evaluate(definition, dates, money, completed),
    };
  });
}

export async function createStreamPipeline(
  userId: string,
  input: {
    name: string;
    colour: string;
    graphStyle: StreamGraphStyle;
    definition: StreamPipelineDefinition;
  },
): Promise<void> {
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new Error('Name the stream.');
  if (!STREAM_COLOURS.includes(input.colour as (typeof STREAM_COLOURS)[number])) {
    throw new Error('Choose a stream colour.');
  }
  if (!STREAM_GRAPH_STYLES.includes(input.graphStyle)) throw new Error('Choose a graph style.');
  await validateDefinition(userId, input.definition);
  const id = randomUUID();
  await db()
    .insert(streamPipelines)
    .values({
      id,
      userId,
      key: `custom:${id}`,
      name,
      colour: input.colour,
      graphStyle: input.graphStyle,
      unit: unitFor(input.definition),
      definition: input.definition,
    });
}

function evaluate(
  definition: StreamPipelineDefinition,
  dates: string[],
  money: Awaited<ReturnType<typeof getMoneyDashboard>> | null,
  completed: Array<{ areaId: string | null; completedAt: Date | null }>,
): number[] {
  if (definition.source === 'account-balances') {
    const selected = (money?.accounts ?? []).filter((account) =>
      definition.accountIds.length > 0
        ? definition.accountIds.includes(account.id)
        : account.includeInNetworth,
    );
    const points = new Map(
      selected.map((account) => [
        account.id,
        new Map(account.points.map((point) => [point.date, point.balanceMinor])),
      ]),
    );
    return dates.map((date) =>
      selected.reduce((total, account) => {
        const balance = points.get(account.id)?.get(date) ?? 0;
        return total + (definition.subtractLiabilities && account.isLiability ? -balance : balance);
      }, 0),
    );
  }

  if (definition.source === 'transactions') {
    return dates.map((date) => {
      const matches = (money?.transactions ?? []).filter(
        (transaction) =>
          transaction.localDate === date &&
          (definition.accountIds.length === 0 ||
            definition.accountIds.includes(transaction.accountId)) &&
          (definition.direction === 'all' || transaction.direction === definition.direction),
      );
      return definition.aggregate === 'count'
        ? matches.length
        : matches.reduce((total, transaction) => total + transaction.amountMinor, 0);
    });
  }

  return dates.map(
    (date) =>
      completed.filter(
        (task) =>
          task.completedAt?.toLocaleDateString('en-CA') === date &&
          (definition.areaIds.length === 0 ||
            (task.areaId !== null && definition.areaIds.includes(task.areaId))),
      ).length,
  );
}

async function validateDefinition(
  userId: string,
  definition: StreamPipelineDefinition,
): Promise<void> {
  if (definition.source === 'account-balances' || definition.source === 'transactions') {
    await validateOwnedIds(userId, definition.accountIds, 'account');
    return;
  }
  await validateOwnedIds(userId, definition.areaIds, 'area');
}

async function validateOwnedIds(
  userId: string,
  ids: string[],
  kind: 'account' | 'area',
): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;
  const rows =
    kind === 'account'
      ? await db()
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.userId, userId), inArray(accounts.id, uniqueIds)))
      : await db()
          .select({ id: areas.id })
          .from(areas)
          .where(and(eq(areas.userId, userId), inArray(areas.id, uniqueIds)));
  if (rows.length !== uniqueIds.length) throw new Error(`Choose one of your ${kind}s.`);
}

function parseDefinition(value: unknown): StreamPipelineDefinition {
  const definition = value as Partial<StreamPipelineDefinition>;
  if (
    definition.source !== 'account-balances' &&
    definition.source !== 'transactions' &&
    definition.source !== 'completed-tasks'
  ) {
    throw new Error('Unknown stream pipeline source.');
  }
  return definition as StreamPipelineDefinition;
}

function unitFor(definition: StreamPipelineDefinition): 'minor-currency' | 'count' {
  if (definition.source === 'account-balances') return 'minor-currency';
  if (definition.source === 'transactions' && definition.aggregate === 'sum') {
    return 'minor-currency';
  }
  return 'count';
}

function validGraphStyle(value: string): StreamGraphStyle {
  return STREAM_GRAPH_STYLES.includes(value as StreamGraphStyle)
    ? (value as StreamGraphStyle)
    : 'Curve';
}
