import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db, devices } from '@vivy/db';
import { currentUserId } from '@/lib/session';
import { hashToken } from '@/lib/auth';
import { fail, handleError, ok, parseBody } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PairRequest = z.object({
  deviceId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'device id must be lowercase alphanumeric with dashes'),
  label: z.string().min(1).max(80),
  platform: z.enum(['android', 'linux', 'chrome', 'web', 'macos', 'ios']),
});

/**
 * POST /api/devices/pair - issue a token to a new device.
 *
 * Authorised by the caller's session rather than a shared secret: in a
 * multi-tenant app a single pairing secret would let anyone holding it attach a
 * device to somebody else's account. The signed-in user is the only thing that
 * can decide which account a device belongs to.
 *
 * The token is returned exactly once, in this response, and only its SHA-256
 * hash is stored. There is no endpoint that can read it back, losing one means
 * re-pairing, which is the right trade for a database holding no live
 * credentials.
 */
export async function POST(request: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) return fail('Unauthorized', 401);

    const body = await parseBody(request, PairRequest);

    // Device ids are global, so namespace them per user. Without this, two
    // accounts both pairing "pixel" would collide on the primary key.
    const scopedId = `${userId.slice(0, 8)}-${body.deviceId}`;

    // 256 bits, base64url so it survives a QR code and an Android intent extra.
    const token = randomBytes(32).toString('base64url');

    await db()
      .insert(devices)
      .values({
        id: scopedId,
        userId,
        label: body.label,
        platform: body.platform,
        tokenHash: hashToken(token),
      })
      .onConflictDoUpdate({
        target: devices.id,
        // Re-pairing rotates the token and clears a previous revocation.
        set: { tokenHash: hashToken(token), label: body.label, revokedAt: null },
      });

    return ok({ deviceId: scopedId, token }, 201);
  } catch (error) {
    return handleError(error);
  }
}
