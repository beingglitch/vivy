export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Liveness probe. Imports nothing, touches no database.
 *
 * Deliberately dependency-free: when the app is misbehaving, this is the check
 * that distinguishes "the server is down" from "something in the render is
 * hanging", and it can only answer that if it shares no code with the pages.
 */
export function GET() {
  return Response.json({ ok: true, at: new Date().toISOString() });
}
