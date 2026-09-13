import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, devices } from '@vivy/db';
import { hashToken } from '@/lib/auth';

/**
 * Pairing, from the browser side.
 *
 * The API route does the same thing for programmatic callers. This exists so the
 * page can pair without a fetch to itself, which on Vercel would be a second
 * cold start to do work the server is already in a position to do.
 */

export interface PairedDevice {
  id: string;
  label: string;
  platform: string;
  lastSeenAt: Date | null;
  createdAt: Date;
  /** Null until a build new enough to report it has checked in. */
  appVersionCode: number | null;
  appVersionName: string | null;
}

export async function listDevices(userId: string, platform?: string): Promise<PairedDevice[]> {
  const where = platform
    ? and(eq(devices.userId, userId), eq(devices.platform, platform), isNull(devices.revokedAt))
    : and(eq(devices.userId, userId), isNull(devices.revokedAt));

  const rows = await db().select().from(devices).where(where).orderBy(desc(devices.createdAt));

  return rows.map((d) => ({
    id: d.id,
    label: d.label,
    platform: d.platform,
    lastSeenAt: d.lastSeenAt,
    createdAt: d.createdAt,
    appVersionCode: d.appVersionCode,
    appVersionName: d.appVersionName,
  }));
}

export interface Pairing {
  /** What the collector must send as its device id. Scoped, so two accounts can both call a phone "pixel". */
  deviceId: string;
  /** Returned once and never stored in the clear. Losing it means pairing again. */
  token: string;
}

export async function pairDevice(
  userId: string,
  name: string,
  platform: 'android' | 'linux' | 'chrome' | 'web' | 'macos' | 'ios',
  label: string,
): Promise<Pairing> {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  if (!slug) throw new Error('Give the device a name.');

  const deviceId = `${userId.slice(0, 8)}-${slug}`;
  const token = randomBytes(32).toString('base64url');

  await db()
    .insert(devices)
    .values({ id: deviceId, userId, label, platform, tokenHash: hashToken(token) })
    .onConflictDoUpdate({
      target: devices.id,
      // Pairing the same name again rotates the token and undoes a revocation,
      // which is what someone reinstalling the app actually wants.
      set: { tokenHash: hashToken(token), label, revokedAt: null },
    });

  return { deviceId, token };
}

/**
 * Stop a device syncing.
 *
 * Revoked rather than deleted: the records it already sent stay attributed to
 * it, and a deleted row would orphan them.
 */
export async function revokeDevice(userId: string, deviceId: string): Promise<void> {
  await db()
    .update(devices)
    .set({ revokedAt: new Date() })
    .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)));
}
