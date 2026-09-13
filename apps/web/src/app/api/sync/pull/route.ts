import { and, asc, eq, gt, gte } from 'drizzle-orm';
import { PullRequest, type PullResponse } from '@vivy/core';
import { db, events as eventsTable, metricsDaily, rawRecords } from '@vivy/db';
import { authenticate, touchDevice } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/sync/pull - a device catches up.
 *
 * POST rather than GET because the cursor is a structured object and the
 * `include` set is a list; encoding both into a query string buys nothing when
 * the caller is always our own client.
 *
 * The asymmetry that makes local-first affordable is here: `raw` and `events`
 * are clipped to the device's retention window, but `rollups` always come in
 * full. Rollups are ~100 bytes per stream per day, so a device can hold every
 * one it has ever produced and still render the year grid with no network.
 */
export async function POST(request: Request) {
  try {
    const device = await authenticate(request);
    const body = await parseBody(request, PullRequest);
    const conn = db();
    const userId = device.userId;

    const wantsRaw = body.include.includes('raw');
    const wantsEvents = body.include.includes('events');
    const wantsRollups = body.include.includes('rollups');

    const rawRows = wantsRaw
      ? await conn
          .select()
          .from(rawRecords)
          .where(
            and(
              eq(rawRecords.userId, userId),
              gt(rawRecords.seq, body.cursor.raw),
              ...(body.since ? [gte(rawRecords.ts, new Date(body.since))] : []),
            ),
          )
          .orderBy(asc(rawRecords.seq))
          .limit(body.limit)
      : [];

    const eventRows = wantsEvents
      ? await conn
          .select()
          .from(eventsTable)
          .where(
            and(
              eq(eventsTable.userId, userId),
              gt(eventsTable.seq, body.cursor.events),
              ...(body.since ? [gte(eventsTable.localDate, body.since)] : []),
            ),
          )
          .orderBy(asc(eventsTable.seq))
          .limit(body.limit)
      : [];

    const rollupRows = wantsRollups
      ? await conn.select().from(metricsDaily).where(eq(metricsDaily.userId, userId))
      : [];

    const response: PullResponse = {
      cursor: {
        raw: rawRows.at(-1)?.seq ?? body.cursor.raw,
        events: eventRows.at(-1)?.seq ?? body.cursor.events,
      },
      // Either collection filling its page means there is more behind it.
      hasMore: rawRows.length === body.limit || eventRows.length === body.limit,
      raw: rawRows.map((r) => ({
        id: r.id,
        ts: r.ts.toISOString(),
        source: r.source as never,
        deviceId: r.deviceId,
        body: r.body as Record<string, unknown>,
        sealed: r.sealed,
        dedupeKey: r.dedupeKey,
      })),
      events: eventRows.map((e) => ({
        id: e.id,
        ts: e.ts.toISOString(),
        localDate: e.localDate,
        tz: e.tz,
        type: e.type,
        source: e.source,
        deviceId: e.deviceId,
        durationS: e.durationS,
        payload: e.payload,
        rawId: e.rawId,
        derivedBy: e.derivedBy,
        dedupeKey: e.dedupeKey,
      })) as PullResponse['events'],
      rollups: rollupRows.map((m) => ({
        localDate: m.localDate,
        stream: m.stream,
        value: m.value,
        meta: (m.meta ?? {}) as Record<string, unknown>,
      })),
    };

    void touchDevice(device.id);
    return ok(response);
  } catch (error) {
    return handleError(error);
  }
}
