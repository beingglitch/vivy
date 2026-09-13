import { createHash, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db, devices } from '@vivy/db';

/**
 * Device authentication for collectors.
 *
 * A device token identifies both the device *and* the user who paired it, so
 * every ingest write is attributed without the collector ever sending a user id.
 * That matters: a device must not be able to claim it belongs to someone else.
 *
 * Tokens are stored only as SHA-256 hashes, so a database dump yields nothing
 * usable. Revocation is per-device and takes effect on the next request.
 */

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time compare, so a token cannot be recovered by timing the response. */
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface AuthedDevice {
  id: string;
  userId: string;
  label: string;
  platform: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Resolve the device behind a request, or throw.
 *
 * Deliberately returns the same message for "no token", "unknown token" and
 * "revoked token": distinguishing them tells an attacker which half of the
 * guess was right.
 */
export async function authenticate(request: Request): Promise<AuthedDevice> {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) throw new AuthError('Unauthorized');

  const rows = await db()
    .select()
    .from(devices)
    .where(and(eq(devices.tokenHash, hashToken(token)), isNull(devices.revokedAt)))
    .limit(1);

  const device = rows[0];
  if (!device) throw new AuthError('Unauthorized');

  return {
    id: device.id,
    userId: device.userId,
    label: device.label,
    platform: device.platform,
  };
}

/** Record liveness. Fire-and-forget: a failed heartbeat must never fail a sync. */
export async function touchDevice(
  deviceId: string,
  version?: { code?: number | undefined; name?: string | undefined },
): Promise<void> {
  try {
    await db()
      .update(devices)
      .set({
        lastSeenAt: new Date(),
        // Only written when reported. An older collector that sends nothing
        // must not wipe what a newer one already recorded.
        ...(version?.code === undefined ? {} : { appVersionCode: version.code }),
        ...(version?.name === undefined ? {} : { appVersionName: version.name }),
      })
      .where(eq(devices.id, deviceId));
  } catch {
    // Intentionally swallowed - see above.
  }
}
