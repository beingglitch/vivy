import { NextRequest, NextResponse } from 'next/server';
import { verifySessionValue, SESSION_COOKIE } from './lib/auth';

// Everything is private. Exceptions:
//  - /login + /api/login: how you get in
//  - /api/events, /api/voice-log: ingestors/devices authenticate with the API key inside the route
//  - /api/cron/*: Vercel Cron authenticates with CRON_SECRET inside the route
//  - /api/mcp/*: claude.ai connector authenticates with the secret path segment inside the route
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === '/login' ||
    pathname === '/api/login' ||
    pathname.startsWith('/api/events') ||
    pathname === '/api/voice-log' ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/mcp')
  ) {
    return NextResponse.next();
  }

  const ok = await verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  // manifest + icons stay public so the PWA can install from the login screen;
  // sw.js too, so the browser can re-fetch the push worker without a session.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.svg|.*\\.png).*)'],
};
