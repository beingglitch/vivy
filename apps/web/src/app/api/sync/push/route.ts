import { and, desc, eq } from 'drizzle-orm';
import { PushRequest, type PushResponse } from '@vivy/core';
import { db, events as eventsTable, rawRecords } from '@vivy/db';
import { authenticate, touchDevice } from '@/lib/auth';
import { fail, handleError, ok, parseBody } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/sync/push - a device hands over its outbox.
 *
 * The contract that makes offline capture safe: this endpoint is idempotent.
 * A collector that loses the network mid-flight resends the entire batch, and
 * rows already present are silently skipped on the unique `(user, dedupe_key)`.
 * A high duplicate count is not a warning, it means replay worked.
 *
 * The user is taken from the device token, never from the request body. A
 * collector cannot write into another account even if it asks to.
 */
export async function POST(request: Request) {
  try {
    const device = await authenticate(request);
    const body = await parseBody(request, PushRequest);

    if (body.deviceId !== device.id) {
      return fail('Device mismatch', 403);
    }

    const conn = db();
    const userId = device.userId;
    let acceptedRaw = 0;
    let acceptedEvents = 0;

    if (body.raw.length > 0) {
      const inserted = await conn
        .insert(rawRecords)
        .values(
          body.raw.map((r) => ({
            id: r.id,
            userId,
            ts: new Date(r.ts),
            source: r.source,
            deviceId: r.deviceId,
            body: r.body,
            sealed: r.sealed,
            dedupeKey: r.dedupeKey,
          })))
        .onConflictDoNothing({ target: [rawRecords.userId, rawRecords.dedupeKey] })
        .returning({ id: rawRecords.id });
      acceptedRaw = inserted.length;
    }

    if (body.events.length > 0) {
      const inserted = await conn
        .insert(eventsTable)
        .values(
          body.events.map((e) => ({
            id: e.id,
            userId,
            ts: new Date(e.ts),
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
          })))
        .onConflictDoNothing({ target: [eventsTable.userId, eventsTable.dedupeKey] })
        .returning({ id: eventsTable.id });
      acceptedEvents = inserted.length;
    }

    const submitted = body.raw.length + body.events.length;
    const response: PushResponse = {
      acceptedRaw,
      acceptedEvents,
      duplicates: submitted - acceptedRaw - acceptedEvents,
      cursor: await currentCursor(userId),
    };

    void touchDevice(device.id, { code: body.appVersionCode, name: body.appVersionName });
    return ok(response);
  } catch (error) {
    return handleError(error);
  }
}

async function currentCursor(userId: string) {
  const conn = db();
  const [raw, evt] = await Promise.all([
    conn
      .select({ seq: rawRecords.seq })
      .from(rawRecords)
      .where(eq(rawRecords.userId, userId))
      .orderBy(desc(rawRecords.seq))
      .limit(1),
    conn
      .select({ seq: eventsTable.seq })
      .from(eventsTable)
      .where(and(eq(eventsTable.userId, userId)))
      .orderBy(desc(eventsTable.seq))
      .limit(1),
  ]);
  return { raw: raw[0]?.seq ?? 0, events: evt[0]?.seq ?? 0 };
}
