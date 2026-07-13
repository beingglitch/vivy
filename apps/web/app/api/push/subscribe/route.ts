import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, pushSubscriptions } from '@/lib/db';

// Save/remove a browser's push subscription. Sits behind the session wall —
// only my own logged-in devices can register themselves.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return NextResponse.json({ error: 'endpoint and keys required' }, { status: 400 });
  }
  await db
    .insert(pushSubscriptions)
    .values({ endpoint, p256dh, auth, userAgent: req.headers.get('user-agent') })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh, auth } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (typeof body?.endpoint !== 'string') {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  }
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint));
  return NextResponse.json({ ok: true });
}
