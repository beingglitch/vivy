import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/google';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const err = req.nextUrl.searchParams.get('error');
  const back = new URL('/settings', req.nextUrl.origin);
  if (err || !code) {
    back.searchParams.set('google', err || 'no-code');
    return NextResponse.redirect(back);
  }
  try {
    await exchangeCode(code, `${req.nextUrl.origin}/api/google/callback`);
    back.searchParams.set('google', 'connected');
  } catch (e) {
    back.searchParams.set('google', 'failed');
    console.error('google oauth callback:', e);
  }
  return NextResponse.redirect(back);
}
