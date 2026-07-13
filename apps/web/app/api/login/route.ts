import { NextRequest, NextResponse } from 'next/server';
import { createSessionValue, SESSION_COOKIE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { passcode } = await req.json().catch(() => ({}));
  if (!passcode || passcode !== process.env.VIVY_PASSCODE) {
    return NextResponse.json({ error: 'wrong passcode' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
