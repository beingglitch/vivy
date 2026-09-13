import { z } from 'zod';
import { loginWithCode, normaliseEmail, verifyLogin } from '@/lib/session';
import { assertNotThrottled, clearFailures, recordFailure, ThrottledError } from '@/lib/throttle';
import { pairDevice } from '@/lib/devices';
import { fail, handleError, ok, parseBody } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  email: z.string().email(),
  /** Exactly one of these. A passphrase, or a code from /api/devices/code. */
  passphrase: z.string().min(1).optional(),
  code: z.string().min(4).max(12).optional(),
  /** Shown in the device list on the web, so it should read like a phone. */
  label: z.string().min(1).max(80),
  platform: z.enum(['android', 'linux', 'chrome', 'macos', 'ios']),
});

/**
 * POST /api/devices/login - sign in from a collector and get a device token.
 *
 * The point of this endpoint is what it *does not* return: no session cookie,
 * no account access. Credentials are verified once and exchanged for a token
 * that can do exactly one thing, append to this user's ingest.
 *
 * So the phone can show a familiar login screen without ever storing the
 * passphrase. It authenticates, takes the token, and forgets what you typed. A
 * lost phone leaks write-only access to one account, not the account itself.
 */
export async function POST(request: Request) {
  try {
    const body = await parseBody(request, Body);
    const email = normaliseEmail(body.email);

    if (!body.passphrase === !body.code) {
      return fail('Send either a passphrase or a code.', 422);
    }

    // Checked before verifying, because the point is to skip the expensive work.
    await assertNotThrottled(email);

    const userId = body.passphrase
      ? await verifyLogin(email, body.passphrase)
      : await loginWithCode(email, body.code ?? '');

    if (!userId) {
      await recordFailure(email);
      // One message for wrong passphrase, wrong code and unknown account:
      // distinguishing them tells an attacker which half of the guess was right.
      return fail('Those details did not work.', 401);
    }

    await clearFailures(email);

    // Named after the hardware, so the device list reads like a shelf of
    // objects rather than a list of identifiers.
    const { deviceId, token } = await pairDevice(userId, body.label, body.platform, body.label);

    return ok({ deviceId, token });
  } catch (error) {
    if (error instanceof ThrottledError) {
      return fail(error.message, 429, { retryAfter: error.retryAfterSeconds });
    }
    return handleError(error);
  }
}
