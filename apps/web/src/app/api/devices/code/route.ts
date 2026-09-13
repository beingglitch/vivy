import { z } from 'zod';
import { requestLoginCode } from '@/lib/session';
import { handleError, ok, parseBody } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({ email: z.string().email() });

/**
 * POST /api/devices/code - send a sign-in code to a collector's owner.
 *
 * Thin wrapper over the same function the web login uses, so a code minted here
 * is the same code, with the same expiry and attempt limit. Two code paths for
 * one concept would drift.
 *
 * Always returns 200, whether or not the account exists. Saying "no such
 * account" would turn this into a free tool for discovering who has signed up.
 */
export async function POST(request: Request) {
  try {
    const { email } = await parseBody(request, Body);
    await requestLoginCode(email);
    return ok({ sent: true });
  } catch (error) {
    return handleError(error);
  }
}
