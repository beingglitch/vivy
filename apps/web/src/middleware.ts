import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cheap gate only.
 *
 * Middleware checks that a session cookie *exists* and nothing more, it cannot
 * reach the database without dragging the driver into the edge runtime. The real
 * verification happens in the authed layout, which is what actually protects
 * data. Treating this as the security boundary would be a mistake; it exists to
 * avoid rendering a whole screen before redirecting.
 */
// `/api/android` is public on purpose: it serves a version number and a link to
// a public GitHub release, and an unpaired phone must be able to discover an
// update before it can possibly hold a session.
const PUBLIC = [
  '/login',
  '/signup',
  '/forgot',
  '/api/health',
  '/api/sync',
  '/api/devices',
  '/api/android',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (!request.cookies.has('vivy_session')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Come back to where they were headed once they are in.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Static assets must never be redirected. The install prompt is evaluated
  // while signed out, so an icon that 307s to /login hands Chrome a page of
  // HTML where it asked for a PNG, and the app silently becomes
  // uninstallable. Anything with an image extension is excluded for the same
  // reason.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)',
  ],
};
